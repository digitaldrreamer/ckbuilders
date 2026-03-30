Week 3 was the first week where I actually interacted with the chain rather than just setting things up. Two tutorials this week: Transfer CKB and Store Data on Cell. Both are dApp examples from the official nervos docs repo.

To grab them without cloning the entire repo I used degit:

```bash
npx degit nervosnetwork/docs.nervos.org/examples/dApp/simple-transfer simple-transfer
npx degit nervosnetwork/docs.nervos.org/examples/dApp/store-data-on-cell store-data-on-cell
```

The examples aren't in the root of the repo, they're nested inside `examples/dApp/`. Wanted to clone only the folders, so I don't bloat my git with the entire repo. degit makes this easy once you have the right path.

![DeGit cloning workflow for the dApp examples](screenshots/week-3-setup-degit-clone-examples.png)

![GitHub repo examples overview](screenshots/week-3-github-examples-overview.png)

![GitHub examples/dApp folder structure](screenshots/week-3-github-docs-examples-folder.png)

![DeGit clone command for store-data-on-cell](screenshots/week-3-degit-clone-store-data-on-cell.png)

Transfer CKB

This one is a simple frontend that lets you view a wallet balance and send CKB to another address. You plug in a private key, it derives your address and shows your balance, then you fill in a recipient address and amount and hit Transfer.

![simple-transfer project files](screenshots/week-3-simple-transfer-project-files.png)

![npm run dev missing script error](screenshots/week-3-simple-transfer-npm-run-dev-missing.png)

![simple-transfer running via parcel start](screenshots/week-3-simple-transfer-parcel-start.png)

![Wallet UI (transfer screen) when capacity is insufficient](screenshots/week-3-wallet-transfer-balance-zero-capacity.png)

I used one of the 20 pre-funded devnet accounts that offckb provides. The balance was sitting at 896468 CKB, which makes sense since these are seeded accounts.

![offckb devnet account dump (test credentials)](screenshots/week-3-offckb-accounts-devnet-test.png)

![Wallet UI (transfer screen) showing seeded balance](screenshots/week-3-wallet-transfer-balance-capacity-896468.png)

![Wallet UI showing derived lock script + capacity](screenshots/week-3-wallet-derived-lockscript-capacity-1020794.png)

First thing I ran into was a validation error when I tried to send 10 CKB. The UI said:

```
amount must larger than 61 CKB
```

![Transfer validation error UI (minimum cell capacity)](screenshots/week-3-wallet-transfer-validation-amount-61.png)

There was a "why" link next to it but it was 404ing, which is worth noting. The actual reason connects back to the Cell model though. A Cell must have enough capacity to store itself. The minimum Cell has:

- 8 bytes for the capacity field
- 32 bytes for the lock script code hash
- 1 byte for hash type
- 20 bytes for the lock args

That's 61 bytes total. And since 1 CKB = 1 byte of on-chain storage, the minimum transfer is 61 CKB. You literally cannot create a Cell that can't hold itself. The constraint isn't arbitrary, it's the storage model enforcing itself.

Sent 100 CKB to account 0. tx hash: `0x78c0725bfe71319c1e007d1f23bfab4b03312be9691d9b045961bffd00a8d95d`

![Transfer success result with tx hash](screenshots/week-3-wallet-transfer-success-tx-hash.png)

Switched to account 0's private key to confirm the balance had increased. It had.

Store Data on Cell

This one is more interesting conceptually. Same setup, private key goes in, but instead of a transfer field there's a message field. You write something, hit Write, it stores the string as raw bytes in the `data` field of a Cell on-chain. Then you hit Read to retrieve it.

![store-data-on-cell project ls output](screenshots/week-3-store-data-on-cell-project-ls.png)

![store-data-on-cell running via parcel start](screenshots/week-3-store-data-on-cell-parcel-start.png)

![Store Data on Cell UI (write message)](screenshots/week-3-store-data-on-cell-write-message-screen.png)

I wrote: "hehe just typing so I can see if something is actually stored. the fate of the world lies in this message."

tx hash: `0x4cc0385243938076f1a33d5c0eef2280a277e8df798391d7de97e47994c12830`

![Store Data on Cell after write shows tx hash](screenshots/week-3-store-data-on-cell-after-write-tx-hash.png)

![Store Data on Cell tx hash modal](screenshots/week-3-store-data-on-cell-tx-hash-modal.png)

Immediately after the tx went through I hit Read and got "cell not found, please retry later". That's just because the transaction was submitted but the block hadn't been mined yet. Waited a few seconds, hit Read again, and the full message came back.

![Store Data on Cell read before block mined (cell not found)](screenshots/week-3-store-data-on-cell-read-cell-not-found.png)

![Store Data on Cell read result prompt](screenshots/week-3-store-data-on-cell-read-message-prompt.png)

That moment is actually the Cell model clicking in a different way. This isn't a database. There's no table with a string column. The string is sitting in the `data` field of a Cell on-chain, locked to my address, and the only way to read it is to query that Cell. The data doesn't live in a contract's storage slot like it would on Ethereum. It lives in a Cell I own. Conceptually that's a big difference.

Next week is tokens and digital objects: Create Fungible Token and Create DOB.


Refs/Sources
Simple transfer example - github.com/nervosnetwork/docs.nervos.org/examples/dApp/simple-transfer
Store data on cell example - github.com/nervosnetwork/docs.nervos.org/examples/dApp/store-data-on-cell
61 CKB minimum explained - docs.nervos.org/docs/wallets/#requirements-for-ckb-transfers (currently 404ing)
Cell model capacity rules - docs.nervos.org/docs/getting-started/how-ckb-works
Perplexity for research