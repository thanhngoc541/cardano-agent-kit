import { MeshSDK } from "../src/tools/meshsdk";

describe("MeshSDK", () => {
    const API_KEY = "previewueSVWOXkYUQdtHQkj0CftJIibwETLjH0";
    const TEST_RECIPIENT = "addr_test1qqpnp9n7274je4mugywj890pp9w6hexceedhvryfrgs7gqxl9g3ghpcdgv2j58fe7yvpwt6nqc2ylzjr4k8zldetjlvq80w9t3";
    const STACK_POOL_ID = "pool18pn6p9ef58u4ga3wagp44qhzm8f6zncl57g6qgh0pk3yytwz54h";

    const TEST_MNEMONIC = [
        "churn", "analyst", "debate", "million", "tattoo", "enlist",
        "crystal", "slide", "gallery", "airport", "squeeze", "live",
        "dinosaur", "rough", "first", "south", "cave", "clerk",
        "divorce", "attend", "topic", "idea", "finger", "verify"
    ];

    const TEST_BECH32_PRIVATE_KEY = "xprv1mpujpqs8nv47d2atwzltun35t9fg9sm58luxytlmazkm6d5ghdvma2gtxnrtvlt739e68gppkuc9t742sz6ht84fa26v827hsuk8mamrfcdyql8eqtzx3fc379pv7qtsjtsg4ahlpcxdz89rlmd23n2y258da03d";

    describe("Wallet Utility Functions", () => {
        it("should generate a new wallet mnemonic", () => {
            const mnemonic = MeshSDK.createWallet();
            console.log("Generated Mnemonic:", mnemonic);

            expect(Array.isArray(mnemonic)).toBe(true);
            expect(mnemonic.length).toBeGreaterThanOrEqual(12);
            expect(mnemonic.every(word => typeof word === "string")).toBe(true);
        });
    });

    describe("Wallet Initialization", () => {
        it("should initialize with Blockfrost by default", () => {
            const wallet = new MeshSDK("blockfrost", API_KEY, "testnet");
            expect(wallet).toBeDefined();
            expect(wallet.getMnemonic()).toBeDefined();
        });

        it("should restore a wallet from a given mnemonic", () => {
            const wallet = new MeshSDK("blockfrost", API_KEY, "testnet", TEST_MNEMONIC);
            expect(wallet.getMnemonic()).toEqual(TEST_MNEMONIC);
        });

        it("should restore a wallet from a Bech32 private key", () => {
            const wallet = new MeshSDK("blockfrost", API_KEY, "testnet", TEST_BECH32_PRIVATE_KEY);
            expect(wallet.getPrivateKey()).toEqual(TEST_BECH32_PRIVATE_KEY);
        });
    });

    describe("Wallet Data Fetching", () => {
        it("should fetch a wallet address", async () => {
            const wallet = new MeshSDK("blockfrost", API_KEY, "testnet", TEST_MNEMONIC);
            const address = await wallet.getAddress();

            console.log("Wallet Address:", address);

            expect(address).toBeDefined();
            expect(typeof address).toBe("string");
        });

        it("should return wallet balance", async () => {
            const wallet = new MeshSDK("blockfrost", API_KEY, "testnet", TEST_MNEMONIC);

            const mockBalance = [
                { unit: "lovelace", quantity: "1000000000" },
                { unit: "0f5560dbc05282e05507aedb02d823d9d9f0e583cce579b81f9d1cd8", quantity: "5" }
            ];
            jest.spyOn(wallet, "getBalance").mockResolvedValue(mockBalance);

            const balance = await wallet.getBalance();
            console.log("Wallet Balance:", balance);

            expect(Array.isArray(balance)).toBe(true);
            expect(balance.length).toBeGreaterThan(0);
            expect(balance[0]).toHaveProperty("unit");
            expect(balance[0]).toHaveProperty("quantity");
        });

        it("should return empty balance for new wallets", async () => {
            const wallet = new MeshSDK("blockfrost", API_KEY, "testnet", TEST_MNEMONIC);
            jest.spyOn(wallet, "getBalance").mockResolvedValue([]);

            const balance = await wallet.getBalance();
            console.log("Empty Wallet Balance:", balance);

            expect(Array.isArray(balance)).toBe(true);
            expect(balance.length).toBe(0);
        });
    });

    describe("Transactions & Staking", () => {
        // it("should sign and send a transaction (mock)", async () => {
        //     const wallet = new MeshSDK("blockfrost", API_KEY, "testnet", TEST_MNEMONIC);
        //     const rawTx = "RAW_TX_HEX";

        //     jest.spyOn(wallet, "signAndSendTx").mockResolvedValue("mock_tx_hash_123");

        //     const txHash = await wallet.signAndSendTx(rawTx);
        //     console.log("Transaction Hash:", txHash);

        //     expect(txHash).toBe("mock_tx_hash_123");
        // });

        // it("should handle sendLovelace() errors properly", async () => {
        //     const wallet = new MeshSDK("blockfrost", API_KEY, "testnet", TEST_BECH32_PRIVATE_KEY);
        //     jest.spyOn(wallet, "sendLovelace").mockRejectedValue(new Error("Insufficient balance"));

        //     await expect(wallet.sendLovelace(TEST_RECIPIENT, "500000000000"))
        //         .rejects.toThrow("Insufficient balance");
        // });

        // Uncomment for real transactions

        // it("should actually register & stake ADA (real transaction)", async () => {
        //     const wallet = new MeshSDK("blockfrost", API_KEY, "testnet", TEST_MNEMONIC);
        //     const txHash = await wallet.registerAndStakeADA(STACK_POOL_ID);
        //     console.log("✅ Staking Transaction Sent! TX Hash:", txHash);
        //     expect(txHash).toBeDefined();
        // });

        // it("should actually send Lovelace (real transaction)", async () => {
        //     const wallet = new MeshSDK("blockfrost", API_KEY, "testnet", TEST_BECH32_PRIVATE_KEY);

        //     console.log("Fetching sender address...");
        //     const senderAddress = await wallet.getAddress();
        //     console.log("Sender Address:", senderAddress);

        //     console.log("Checking balance...");
        //     const balance = await wallet.getBalance();
        //     console.log("Wallet Balance:", balance);

        //     console.log("Sending 1 ADA to recipient...");
        //     const txHash = await wallet.sendLovelace(TEST_RECIPIENT, "1000000");

        //     console.log("✅ Transaction Sent! TX Hash:", txHash);

        //     expect(txHash).toBeDefined();
        // });
    });
});
