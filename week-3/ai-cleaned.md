# Week 3 — Transfer CKB + Store Data on Cell

Week 3 is where I first interacted with the chain directly. I completed two dApp tutorials from the official Nervos docs repo: **Transfer CKB** and **Store Data on Cell**.

## Setup (degit + example folders)

To avoid cloning the entire docs repository, I used `degit` to pull only the relevant example folders:

```bash
npx degit nervosnetwork/docs.nervos.org/examples/dApp/simple-transfer simple-transfer
npx degit nervosnetwork/docs.nervos.org/examples/dApp/store-data-on-cell store-data-on-cell
```

![DeGit cloning workflow for the dApp examples](screenshots/week-3-setup-degit-clone-examples.png)
![GitHub repo examples overview](screenshots/week-3-github-examples-overview.png)
![GitHub examples/dApp folder structure](screenshots/week-3-github-docs-examples-folder.png)
![DeGit clone command for store-data-on-cell](screenshots/week-3-degit-clone-store-data-on-cell.png)

## Transfer CKB

This frontend lets you:
- paste a private key
- derive your CKB address + lock script
- view balance/capacity
- enter a recipient address + amount
- submit a transfer

![simple-transfer project files](screenshots/week-3-simple-transfer-project-files.png)
![npm run dev missing script error](screenshots/week-3-simple-transfer-npm-run-dev-missing.png)
![simple-transfer running via parcel start](screenshots/week-3-simple-transfer-parcel-start.png)

At first, I hit a capacity constraint in the UI.

![Wallet UI (transfer screen) when capacity is insufficient](screenshots/week-3-wallet-transfer-balance-zero-capacity.png)

I used one of the 20 pre-funded devnet accounts from `offckb` (these reset each devnet reload).

![offckb devnet account dump (test credentials)](screenshots/week-3-offckb-accounts-devnet-test.png)
![Wallet UI (transfer screen) showing seeded balance](screenshots/week-3-wallet-transfer-balance-capacity-896468.png)
![Wallet UI showing derived lock script + capacity](screenshots/week-3-wallet-derived-lockscript-capacity-1020794.png)

The UI rejected an attempted transfer of `10` CKB with:

```text
amount must larger than 61 CKB
```

![Transfer validation error UI (minimum cell capacity)](screenshots/week-3-wallet-transfer-validation-amount-61.png)

This is enforced by the Cell storage model: the minimum Cell includes (among other fields) capacity + lock script code hash + hash type + lock args, totaling **61 bytes**, and `1 CKB = 1 byte` of on-chain storage. So the minimum transfer is effectively `61` CKB.

I then sent **100 CKB** successfully.

![Transfer success result with tx hash](screenshots/week-3-wallet-transfer-success-tx-hash.png)

## Store Data on Cell

This dApp uses the same basic setup (private key -> address/lock script), but instead of transferring CKB, it writes a message string into the `data` field of an on-chain Cell, then reads it back.

![store-data-on-cell project ls output](screenshots/week-3-store-data-on-cell-project-ls.png)
![store-data-on-cell running via parcel start](screenshots/week-3-store-data-on-cell-parcel-start.png)
![Store Data on Cell UI (write message)](screenshots/week-3-store-data-on-cell-write-message-screen.png)

I wrote:
> hehe just typing so I can see if something is actually stored. the fate of the world lies in this message.

![Store Data on Cell after write shows tx hash](screenshots/week-3-store-data-on-cell-after-write-tx-hash.png)
![Store Data on Cell tx hash modal](screenshots/week-3-store-data-on-cell-tx-hash-modal.png)

Immediately after submitting the transaction, the subsequent read returned:
`cell not found, please retry later` (the transaction had been submitted, but the block wasn’t mined yet).

![Store Data on Cell read before block mined (cell not found)](screenshots/week-3-store-data-on-cell-read-cell-not-found.png)
![Store Data on Cell read result prompt](screenshots/week-3-store-data-on-cell-read-message-prompt.png)

This experience made the Cell model click: this is not a database with a string column. The message lives inside a Cell’s `data` field, and retrieving it is essentially querying that Cell by address/lock and locating the expected output.

## Refs / Sources

- Simple transfer example: https://github.com/nervosnetwork/docs.nervos.org/examples/dApp/simple-transfer
- Store data on cell example: https://github.com/nervosnetwork/docs.nervos.org/examples/dApp/store-data-on-cell
- 61 CKB minimum explained (may 404 depending on docs state): https://docs.nervos.org/docs/wallets/#requirements-for-ckb-transfers
- Cell model capacity rules: https://docs.nervos.org/docs/getting-started/how-ckb-works
- Perplexity for research.
