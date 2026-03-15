# Week 1: CKB Fundamentals (Cleaned Notes)

## Two Major Blockchain Models

Blockchains generally choose between two ledger models:

1. **Bitcoin model (UTXO)**  
   There is no "account" in the traditional sense. The ledger is a set of unspent outputs. Spending means consuming one or more of these and creating new ones—like paying with cash and receiving change.

2. **Ethereum model (account-based)**  
   More intuitive for most people: you have an account with a balance; transactions update that balance. Native ETH balances are held directly by accounts, while many token balances (e.g., ERC-20) are tracked in smart contracts. If a token contract is exploited, balances tracked by that contract can be at risk.

---

## CKB: Generalized UTXO

CKB takes the Bitcoin (UTXO) model and generalizes it.

Bitcoin UTXOs store only a value. CKB replaces the UTXO with a **Cell** ([docs](https://docs.nervos.org/docs/getting-started/how-ckb-works#how-transaction-works)), which stores four fields:

| Field        | Purpose |
|-------------|---------|
| **capacity** | How many CKBytes it holds; also determines how much space it uses on-chain. |
| **data**     | Arbitrary bytes: token balance, code, NFT, or any other data. |
| **lock script** | Who can spend this Cell (ownership). |
| **type script** | Rules for how this Cell can be used (behaviour). |

Lock and type scripts are executable programs that run on-chain.

Like a UTXO, a Cell is consumed entirely in a transaction; you create new Cells as outputs and the consumed one becomes a dead cell. The difference is that a Cell can hold arbitrary data and enforce custom logic, not just a coin amount.

**Main benefit vs account model:** Your token balance lives in a Cell you own. The contract defines the rules, but custody is yours. If the token contract is exploited, an attacker cannot move assets out of your Cell without your private key.

---

## Scripts and CKB-VM

Lock and type scripts are binaries that run on **CKB-VM**, which is based on the **RISC-V** instruction set ([docs](https://docs.nervos.org/docs/getting-started/how-ckb-works#scripts)).

CKB chose RISC-V mainly for one property: **crypto-agnosticism**. Many chains bake cryptographic algorithms into the VM, so adding new primitives (e.g. Schnorr, BLS, zk-SNARKs) needs a network upgrade. CKB-VM has no hardcoded crypto instructions; new primitives can be deployed as normal scripts in Cells and used like libraries—no hard fork. Scripts can be written in any language that targets RISC-V (C, Rust, JavaScript, etc.), avoiding the kind of language lock-in you get with Solidity on Ethereum.

---

## Why Proof of Work?

CKB uses PoW even though many newer chains use PoS. The goal is a maximally secure, neutral base layer—the "Common Knowledge Base" in the name. PoW is slower and costlier but is the most battle-tested security model; that tradeoff is intentional. CKB does not optimize for speed at the base layer; speed and scalability are delegated to Layer 2. This is described in the [Nervos Network positioning paper](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0001-positioning/0001-positioning.md).

---

## The Layered Model

The design splits into two layers:

- **Layer 1 (CKB):** Security, settlement, and state storage. Conservative by design; application logic is kept off the base layer.
- **Layer 2:** Speed, scalability, and application execution. It can include EVM rollups, payment channels, or custom chains; CKB-VM can verify the proofs they produce.

The idea is a base layer that is flexible and neutral enough that many kinds of systems can be built on top without changing the base layer.

---

## References / Sources

- Scripts as binaries on CKB-VM (RISC-V): [docs.nervos.org/docs/getting-started/how-ckb-works](https://docs.nervos.org/docs/getting-started/how-ckb-works) (CKB-VM section)
- CKB-VM crypto-agnostic, no hardcoded crypto: [docs.nervos.org/docs/tech-explanation/glossary](https://docs.nervos.org/docs/tech-explanation/glossary) (search "crypto-agnostic")
- Schnorr, BLS, zk-SNARKs without hard forks: [docs.nervos.org/docs/tech-explanation/ckb-vm](https://docs.nervos.org/docs/tech-explanation/ckb-vm)
- Scripts in C, Rust, JavaScript (RISC-V): [docs.nervos.org/docs/script/program-language-for-script](https://docs.nervos.org/docs/script/program-language-for-script)
- PoW, NC-MAX consensus: [docs.nervos.org/docs/tech-explanation/nervos-blockchain](https://docs.nervos.org/docs/tech-explanation/nervos-blockchain)
- Layer 1 vs Layer 2: [docs.nervos.org/docs/tech-explanation/glossary](https://docs.nervos.org/docs/tech-explanation/glossary) (search "layer 1", "layer 2")
- L2 for scalability, L1 for security and settlement: [docs.nervos.org/docs/tech-explanation/nervos-blockchain](https://docs.nervos.org/docs/tech-explanation/nervos-blockchain)
