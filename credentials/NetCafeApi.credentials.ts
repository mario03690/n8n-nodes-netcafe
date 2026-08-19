import type {
	ICredentialTestRequest,
	ICredentialType,
	IAuthenticateGeneric,
	INodeProperties,
} from 'n8n-workflow';

export class NetCafeApi implements ICredentialType {
	name = 'netCafeApi';

	displayName = 'AI NetCafe API';

	documentationUrl = 'https://ainetcafe.com/mcp.html';

	icon = { light: 'file:netcafe.svg', dark: 'file:netcafe.dark.svg' } as const;

	properties: INodeProperties[] = [
		{
			displayName: 'AllRouter API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Your AllRouter key. Removes the free-quota limit; the node also works without any credential at all.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: { Authorization: '=Bearer {{$credentials.apiKey}}' },
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://ainetcafe.com',
			url: '/t/hs_lookup',
			qs: { code: '7117', s: 'n8n-credtest' },
		},
	};
}
