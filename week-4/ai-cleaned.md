Week 4 was all about tokens and digital objects on CKB: xUDT fungible tokens, Spore digital objects, and some exploration in CCC Playground and CKB Tools.

## Setup

Same `degit` setup as last week:

```bash
npx degit nervosnetwork/docs.nervos.org/examples/dApp/xudt xudt
npx degit nervosnetwork/docs.nervos.org/examples/dApp/create-dob create-dob
```

![degit cloning xudt and create-dob](screenshots/degit-clone-xudt-create-dob.png)

## xUDT — Fungible Tokens

The xUDT dApp puts the whole flow on a single page:

- **Step 1**: Issue
- **Step 2**: View
- **Step 3**: Transfer

Nice and linear, which makes it easy to see the full lifecycle.

I plugged in a devnet private key, and the app showed a balance of **860518 CKB**. I set the amount to **80** and issued a token.

![xUDT app loaded with account balance](screenshots/xudt-app-loaded-balance.png)

Issuing the token produced a transaction hash and xUDT args:

![xUDT token issued — tx hash and args](screenshots/xudt-token-issued-tx-hash.png)

```
Transaction hash: 0x369d1129678aa576761c9f32a085c1027e6a983fe316fac31da87503e094278f
Token xUDT args: 0xfefd847ee86aa34c9fe65452e233e8d389258ddf5ac7d9dbfd1b6f86007c35f000000000
```

The UI highlights something important: the **xUDT args behave like a unique token ID**, and they are the **lock script hash of the issuer**.

On Ethereum, a fungible token is identified by the contract that manages it. On CKB there is no shared, central contract for a given token. The token’s type is baked into the cell’s type script, and the issuer’s lock hash is what makes it unique. If two different people “issue the same token,” they actually create different token IDs. It is a fundamentally different model.

In Step 2, I queried the issued token:

![xUDT token queried — cell 0 result](screenshots/xudt-token-query-result.png)

```
Cell #0
Token amount: 80
Token holder's lock script args: 0x758d311c8483e0602dfad7b69d9053e3f917457d
```

Then I transferred **16 tokens** to another account in Step 3. That transaction went through without issues.

![xUDT token transfer result](screenshots/xudt-token-transfer-result.png)

## DOB — Digital Objects (Spore)

Spore represents digital objects directly on-chain. It does **not** store a pointer to an image or an IPFS hash. The actual content lives inside the cell’s data field.

On the first attempt I uploaded a relatively large image and clicked **Create DOB**:

![DOB transaction size error](screenshots/dob-tx-size-error.png)

```
Unhandled Rejection (Error): Expected the transaction size to be <= 512000, actual size: 661768
```

CKB enforces a **512 KB transaction size limit**. That makes sense once you remember that the image bytes themselves must fit in the transaction, not just a reference to them. True on-chain storage means the chain actually holds the data, so transaction and storage limits become very real constraints.

To stay within the limit, I switched to a smaller image, `goremote-with-white-text-transparent-bg.png`, which is **68939 bytes**:

![DOB smaller image selected — 68939 bytes](screenshots/dob-smaller-image-selected.png)

The second attempt failed with a network error:

![DOB network request failed error](screenshots/dob-network-request-failed.png)

Nothing obvious had changed—devnet was still running—so I restarted it and tried again.

This time the DOB was created successfully and the UI surfaced the transaction hash:

![DOB created — tx hash visible](screenshots/dob-created-tx-hash.png)

```
tx Hash: 0xba77bf19cca8f8bc17843490b38c9b5484d0f8b5a7fc29fec66435f8ce2ae1d6
```

After that I hit **Check Spore Content**, and the image rendered directly in the browser:

![DOB content retrieved — image rendered on-chain](screenshots/dob-content-retrieved-image.png)

```
contentType: image/jpeg
```

The key point: the image data came **back off the chain**. Not from an application server, not from IPFS—straight from the cell. This is what makes Spore different from most NFT implementations.

On Ethereum, an NFT is usually:

1. A token ID  
2. That points to a metadata URL  
3. That in turn points to an image hosted somewhere  

If the server disappears, the NFT often degrades to “just a number.” With Spore, the **content is the cell**, so as long as the chain exists, the object does too.

## CCC Playground

I spent some time in the CCC Playground at `https://live.ckbccc.com`. The default example builds a transfer transaction step by step.

The most useful part is the **right-hand panel**, which visualizes the transaction as it is constructed, showing cells as shapes with their capacities. You can watch inputs get consumed and outputs appear in real time as each line of code runs.

![CCC Playground before running](screenshots/ccc-playground-before-run.png)

![CCC Playground after running — Cell visualisation](screenshots/ccc-playground-after-run-cells.png)

![CCC Playground final output Cell details](screenshots/ccc-playground-output-cell-details.png)

Seeing the transaction this way made the cell model click in a different way than just reading about it. Cells go in, cells come out. There is a change cell and a fee cell. It is the same mental model as cash, but the playground lets you see it directly.

## CKB Tools

I also looked at `https://ckb.tools`, which bundles:

- An address inspector  
- Bootstrap data  
- A key generator  
- A SUDT tool  

![CKB Tools homepage](screenshots/ckb-tools-homepage.png)

![CKB Tools Generator page](screenshots/ckb-tools-generator.png)

It still references MetaMask and PW-SDK, which are older patterns. The ecosystem has largely moved toward CCC and Omnilock. Even so, CKB Tools is still handy for quick keypair generation and address inspection, just not where the most active development seems to be happening.

## References

- xUDT tutorial — `docs.nervos.org/docs/dapp/create-token`  
- Spore/DOB tutorial — `docs.nervos.org/docs/dapp/create-dob`  
- CCC Playground — `live.ckbccc.com`  
- CKB Tools — `ckb.tools`  
- Spore Protocol — `docs.spore.pro`  

Note: I missed the last hackathon, but I'm working on documentation for my first project on CKB.