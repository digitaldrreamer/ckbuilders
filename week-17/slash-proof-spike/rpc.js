const URL = process.env.CKB_RPC_URL ?? 'https://testnet.ckbapp.dev/';

let id = 0;

export async function rpc(method, params = []) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: ++id, jsonrpc: '2.0', method, params }),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

export const getBlockByNumber = (n) => rpc('get_block_by_number', ['0x' + BigInt(n).toString(16)]);
export const getTransaction = (h) => rpc('get_transaction', [h]);
