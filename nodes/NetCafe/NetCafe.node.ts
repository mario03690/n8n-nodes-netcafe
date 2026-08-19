import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

// The HTTP call lives outside execute() on purpose: n8n's community-node lint
// forbids calling helpers.httpRequest inside a function that also retrieves
// credentials, because that pattern usually means hand-rolled auth. Here auth is
// genuinely optional — an empty key is a supported configuration, since anonymous
// calls draw on a free quota — so the two concerns are split instead.
async function callApi(
	ctx: IExecuteFunctions,
	options: IHttpRequestOptions,
	authenticated: boolean,
): Promise<IDataObject> {
	if (authenticated) {
		return (await ctx.helpers.httpRequestWithAuthentication.call(
			ctx,
			'netCafeApi',
			options,
		)) as IDataObject;
	}
	return (await ctx.helpers.httpRequest(options)) as IDataObject;
}

const BASE = 'https://ainetcafe.com';
// Attribution: lets us tell whether the n8n channel produces real, repeated
// calls rather than one-off installs that never get used.
const SOURCE = 'n8n';

export class NetCafe implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI NetCafe',
		name: 'netCafe',
		icon: { light: 'file:netcafe.svg', dark: 'file:netcafe.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Deterministic tools: reconcile payments without a shared key, read Excel, diff tables, find duplicate companies, look up US HS codes, test mainland-China reachability',
		defaults: { name: 'AI NetCafe' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		// Makes every operation callable by an n8n AI Agent, not just from a
		// hand-built workflow — that is the whole point of shipping this node.
		usableAsTool: true,
		credentials: [{ name: 'netCafeApi', required: false }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'reconcile',
				options: [
					{
						name: 'Diff Two Tables',
						value: 'diffTables',
						description: 'Compare two tables on a key column: only in A, only in B, changed values',
						action: 'Diff two tables',
					},
					{
						name: 'Find Duplicate Companies',
						value: 'dedupe',
						description:
							'Find records that are probably the same company under different names, checked against tax-ID checksums. Never auto-merges.',
						action: 'Find duplicate companies',
					},
					{
						name: 'Look Up US HS Code',
						value: 'hsLookup',
						description: 'Verify a US HS/HTS tariff code against the official USITC schedule',
						action: 'Look up a US HS code',
					},
					{
						name: 'Read Excel File',
						value: 'readXlsx',
						description:
							'Read an .xlsx from a URL. Dates come back as YYYY-MM-DD and leading zeros survive.',
						action: 'Read an excel file',
					},
					{
						name: 'Reconcile Bank vs Ledger',
						value: 'reconcile',
						description:
							'Reconcile a bank statement against a ledger with no shared reference number. Handles 1:N and N:1 payments.',
						action: 'Reconcile bank vs ledger',
					},
					{
						name: 'Test China Reachability',
						value: 'chinaReachability',
						description: 'Test whether a URL is reachable from mainland China, measured from a real mainland network',
						action: 'Test china reachability',
					},
				],
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com',
				description: 'The URL to test or to download',
				displayOptions: { show: { operation: ['chinaReachability', 'readXlsx'] } },
			},
			{
				displayName: 'Sheet Name',
				name: 'sheet',
				type: 'string',
				default: '',
				description: 'Which sheet to read. Leave empty for the first sheet.',
				displayOptions: { show: { operation: ['readXlsx'] } },
			},
			{
				displayName: 'HS Code',
				name: 'code',
				type: 'string',
				default: '',
				required: true,
				placeholder: '0409000000',
				description:
					'The code as text, 2 to 10 digits. Keep leading zeros: chapters 01-09 begin with a zero, so 0409000000 (natural honey) is not 409000000.',
				displayOptions: { show: { operation: ['hsLookup'] } },
			},
			{
				displayName: 'Bank Statement (CSV)',
				name: 'bankCsv',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'Bank statement as CSV text, including the header row',
				displayOptions: { show: { operation: ['reconcile'] } },
			},
			{
				displayName: 'Ledger (CSV)',
				name: 'ledgerCsv',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'Ledger as CSV text, including the header row',
				displayOptions: { show: { operation: ['reconcile'] } },
			},
			{
				displayName: 'Date Window (Days)',
				name: 'dateWindowDays',
				type: 'number',
				default: 5,
				description: 'How many days apart two rows may be and still match',
				displayOptions: { show: { operation: ['reconcile'] } },
			},
			{
				displayName: 'Table A (CSV)',
				name: 'csvA',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'First table as CSV text',
				displayOptions: { show: { operation: ['diffTables'] } },
			},
			{
				displayName: 'Table B (CSV)',
				name: 'csvB',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'Second table as CSV text',
				displayOptions: { show: { operation: ['diffTables'] } },
			},
			{
				displayName: 'Key Column',
				name: 'key',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'invoice_no',
				description: 'Column name used to line up rows between the two tables',
				displayOptions: { show: { operation: ['diffTables'] } },
			},
			{
				displayName: 'Records (CSV)',
				name: 'recordsCsv',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'CSV text with one row per company and a name column',
				displayOptions: { show: { operation: ['dedupe'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		// Credentials are optional: anonymous calls draw on a free quota, so a
		// workflow can be built and tested before anyone signs up for anything.
		let apiKey = '';
		try {
			const creds = await this.getCredentials('netCafeApi');
			apiKey = ((creds?.apiKey as string) || '').trim();
		} catch {
			apiKey = '';
		}
		const authenticated = apiKey.length > 0;
		const headers: IDataObject = { accept: 'application/json' };

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;
			const p = (n: string, d: unknown = '') => this.getNodeParameter(n, i, d);

			let options: IHttpRequestOptions;
			if (operation === 'chinaReachability') {
				options = {
					method: 'GET',
					url: `${BASE}/t/china_reachability`,
					qs: { url: p('url'), s: SOURCE },
					headers,
					json: true,
				};
			} else if (operation === 'hsLookup') {
				options = {
					method: 'GET',
					url: `${BASE}/t/hs_lookup`,
					// String() on purpose: a code such as 0409000000 loses its leading
					// zero the moment anything treats it as a number.
					qs: { code: String(p('code')), s: SOURCE },
					headers,
					json: true,
				};
			} else if (operation === 'readXlsx') {
				const qs: IDataObject = { url: p('url'), s: SOURCE };
				const sheet = p('sheet') as string;
				if (sheet) qs.sheet = sheet;
				options = { method: 'GET', url: `${BASE}/t/read_xlsx`, qs, headers, json: true };
			} else {
				// Table tools go over POST: a whole CSV does not fit in a query string.
				const map: Record<string, { path: string; body: IDataObject }> = {
					reconcile: {
						path: 'match_transactions',
						body: {
							text_a: p('bankCsv'),
							text_b: p('ledgerCsv'),
							date_window_days: p('dateWindowDays', 5),
						},
					},
					diffTables: {
						path: 'diff_tables',
						body: { text_a: p('csvA'), text_b: p('csvB'), key: p('key') },
					},
					dedupe: { path: 'dedupe_entities', body: { text: p('recordsCsv') } },
				};
				const spec = map[operation];
				if (!spec) {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, {
						itemIndex: i,
					});
				}
				options = {
					method: 'POST',
					url: `${BASE}/t/${spec.path}`,
					qs: { s: SOURCE },
					body: spec.body,
					headers: { ...headers, 'content-type': 'application/json' },
					json: true,
				};
			}

			let response: IDataObject;
			try {
				response = await callApi(this, options, authenticated);
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}

			// A 200 can still carry the quota wall. It comes with its own guidance —
			// a one-click unlock link — so relay that instead of a bare error: the
			// person running the workflow then knows exactly what to do next.
			if (response?.error) {
				const hint = (response.tell_your_human || response.how_to_continue || '') as string;
				const message = `${response.error as string}${hint ? `\n${hint}` : ''}`;
				if (this.continueOnFail()) {
					out.push({ json: { error: message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), message, { itemIndex: i });
			}

			out.push({ json: response, pairedItem: { item: i } });
		}

		return [out];
	}
}
