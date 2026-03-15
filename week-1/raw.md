So I learnt first that there are two major models that blockchains choose between.

One is the bitcoin model, aka UTXO model. An "account" doesn't exist in the traditional sense. Instead, there's a bag of unspent coins, which is the ledger. Spending means you consume one or more coins and create new ones. Just like cash where you give someone 1000 and get change of 500.

Then there's the Ethereum approach, aka account model. It makes more sense to the average person since its more relatable. You have an account with a balance. Transactions affect that balance. The balance is what amount the trasactions, in or out, resolve to. The token balance lives inside a smart contract, not owned directly by you. SO it means, since ownership is to the contract, if it gets exploited or compromised, your tokens can be stolen.

Now, CKB takes Bitcoin's model, and generalizes it. How?


Bitcoin's UTXO only stores a number, a value. CKB replaces the UTXO with something called a "Cell" (https://docs.nervos.org/docs/getting-started/how-ckb-works#how-transaction-works), which stores four things instead of one:

- `capacity`: how many CKBytes it holds, which also determines how much space it takes up on-chain
- `data`: arbitrary bytes. Could be a token balance, a piece of code, an NFT, anything
- `lock script`: who can spend this Cell (ownership)
- `type script`: rules for how this Cell can be used (behaviour)

The lock and type are both executable programs that can be executed on chain.

So the Cell is basically a UTXO model that grew up. Just like UTXO, you consume it wholly and create new ones as outputs and the consumed one becomes a Dead Cell, gone forever. But now it can hold any data and enforce any logic, not just a coin value.

Now, the main value here compared to UTXO is that your token balance lives in a Cell you own, not in a random contract someone else deployed. The contract defines the rules, yes, but the custody/ownership is yours. If the token contract gets exploited, an attacker can't reach into your Cell. They'd need to also know your private key first.

https://docs.nervos.org/docs/getting-started/how-ckb-works#scripts

Scripts and CKB-VM

The lock and type scripts I mentioned above are just binaries, compiled programs that run on CKB's virtual machine called CKB-VM, which is built on the RISC-V instruction set. The reason CKB chose RISC-V comes down to one property: it's crypto-agnostic. Most blockchains hardcode their cryptographic algorithms into the VM itself, so when better primitives came along, adding them required network-wide upgrades. CKB-VM has no special crypto instructions baked in, which means new primitives like Schnorr signatures, BLS, and zk-SNARKs can be deployed as ordinary scripts inside Cells and used like any other library. No hard fork needed. This also means scripts can be written in C, Rust, JavaScript, anything that compiles to RISC-V, avoiding the kind of language lock-in you get with Solidity on Ethereum.

Why Proof of Work?

CKB uses PoW despite most newer chains moving to PoS. The idea is that CKB is meant to be a maximally secure, neutral base layer, the "Common Knowledge Base" the name refers to. PoW is slower and more expensive but it's the most battle-tested security model available, and that tradeoff is intentional. CKB isn't trying to be fast at the base layer. Speed and scalability are Layer 2's job. This philosophy is laid out directly in the Nervos Network positioning paper: https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0001-positioning/0001-positioning.md

The layered model

The architecture splits cleanly into two concerns. Layer 1, which is CKB itself, handles security, settlement, and state storage. It's conservative by design and never gets congested with application logic. Layer 2 handles speed, scalability, and application execution, and can be EVM rollups, payment channels, or custom chains, because CKB-VM can verify any proof they produce. The whole idea is to build a base layer so flexible and neutral that any possible future can be built on top of it without the base layer ever needing to change.



Refs/Sources
"Scripts are binaries running on CKB-VM built on RISC-V" - docs.nervos.org/docs/getting-started/how-ckb-works (CKB-VM section)
"CKB-VM is crypto-agnostic, no hardcoded crypto instructions" - docs.nervos.org/docs/tech-explanation/glossary (search "crypto-agnostic")
"Schnorr, BLS, zk-SNARKs deployable without hard forks" - docs.nervos.org/docs/tech-explanation/ckb-vm
"Scripts can be written in C, Rust, JavaScript, anything targeting RISC-V" - docs.nervos.org/docs/script/program-language-for-script
"PoW for security and decentralization, NC-MAX consensus" - docs.nervos.org/docs/tech-explanation/nervos-blockchain
Layer 1 vs Layer 2 definitions - docs.nervos.org/docs/tech-explanation/glossary (search "layer 1" and "layer 2")
"Layer 2 for scalability, Layer 1 for security and settlement" - docs.nervos.org/docs/tech-explanation/nervos-blockchain