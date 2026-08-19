# n8n-nodes-netcafe

Deterministic tools for n8n, hosted and **reachable from mainland China**. Every operation is also
exposed to n8n's AI Agent (`usableAsTool`), so an agent can call it directly.

No API key needed to start: anonymous calls draw on a free quota.

## Operations

| Operation | What it does |
| --- | --- |
| **Reconcile Bank vs Ledger** | Reconcile a bank statement against a ledger with **no shared reference number**. Matches on amount, date window and references found in free text; handles instalments (1:N) and combined payments (N:1); reports ambiguous cases instead of forcing a match. |
| **Diff Two Tables** | Compare two tables on a key column: only in A, only in B, and rows in both with different values. |
| **Find Duplicate Companies** | Detect the same company written under different names, cross-checked against tax-ID checksums, phone, domain and address. Never auto-merges — returns evidence, and flags look-alike pairs that are provably different. |
| **Look Up US HS Code** | Verify a US HS/HTS tariff code against the official USITC schedule before it goes on customs paperwork. |
| **Read Excel File** | Read an .xlsx from a URL. Dates come back as `YYYY-MM-DD` instead of Excel serial numbers, leading zeros in IDs survive, merged cells are reported. |
| **Test China Reachability** | Test whether a URL is actually reachable from mainland China: HTTP status, latency, DNS from a Chinese resolver. Measured from a real mainland network, not inferred. |

These are **deterministic** — no model call inside, so results are repeatable, and every result
involving counts or money carries an arithmetic self-check computed in code. If the numbers do
not reconcile, the response says so instead of returning a table nobody can verify.

## Installation

In n8n: **Settings → Community nodes → Install**, then enter `n8n-nodes-netcafe`.

## Credentials

Optional. Leave the credential unset to use the anonymous free quota, or add an **AllRouter API
key** (`sk-...`) to remove the quota limit.

## Notes

- **Keep leading zeros in HS codes.** Chapters 01–09 all begin with a zero, so `0409000000`
  (natural honey) is not the same code as `409000000`.
- **When the free quota runs out**, the node surfaces the API's own guidance, which includes a
  one-click unlock link. No signup required.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [AI NetCafe tool documentation](https://ainetcafe.com/mcp.html)

## License

MIT
