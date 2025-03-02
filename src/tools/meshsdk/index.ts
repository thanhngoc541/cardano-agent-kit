import {
    BlockfrostProvider,
    KoiosProvider,
    MaestroProvider,
    U5CProvider,
    MeshWallet,
    Transaction,
    ForgeScript,
    Mint,
    Asset,
} from "@meshsdk/core";


export class MeshSDK {
    private wallet: MeshWallet | null = null;
    private provider: BlockfrostProvider | KoiosProvider | MaestroProvider | U5CProvider;
    private mnemonic?: string[];
    private privateKey?: string;
    private networkId: 0 | 1; // 0 = Testnet, 1 = Mainnet

    /**
     * @param {string} providerType - The blockchain provider to use. Supported values: `"blockfrost"`, `"maestro"`, `"koios"`, `"u5c"`.
     * @param {string} apiKey - The API key required for the selected provider.
     * @param {string} [network="testnet"] - The Cardano network to use. Supported values: `"testnet"`, `"mainnet"`. Defaults to `"testnet"`.
     * @param {string} [mnemonicOrBech32] - A **12/24-word mnemonic** (space-separated) or a **Bech32 root private key** for wallet import. If not provided, a new wallet is generated.
     */
    constructor(
        providerType: string,
        apiKey: string,
        network?: string,
        mnemonicOrBech32?: string[] | string
    ) {
        let networkType = network ?? "testnet";

        if (!apiKey) throw new Error("API key is required");

        this.networkId = networkType === "mainnet" ? 1 : 0; // Assign network ID

        // ✅ Select the correct provider dynamically
        switch (providerType) {
            case "blockfrost":
                this.provider = new BlockfrostProvider(apiKey);
                break;
            case "maestro":
                this.provider = new MaestroProvider({ apiKey, network: networkType === "mainnet" ? "Mainnet" : "Preprod" });
                break;
            case "koios":
                this.provider = new KoiosProvider(apiKey);
                break;
            case "u5c":
                this.provider = new U5CProvider({ url: apiKey });
                break;
            default:
                throw new Error("Invalid provider type");
        }

        this.initializeWallet(mnemonicOrBech32);

    }

    private initializeWallet(mnemonicOrBech32?: string[] | string) {
        let walletKey: { type: "mnemonic"; words: string[] } | { type: "root"; bech32: string };

        if (Array.isArray(mnemonicOrBech32) && mnemonicOrBech32.length > 0) {
            this.mnemonic = mnemonicOrBech32;
            walletKey = { type: "mnemonic", words: this.mnemonic };
        } else if (typeof mnemonicOrBech32 === "string") {
            this.privateKey = mnemonicOrBech32;
            walletKey = { type: "root", bech32: this.privateKey };
        } else {
            this.mnemonic = MeshSDK.createWallet(); // ✅ Generate new wallet mnemonic
            walletKey = { type: "mnemonic", words: this.mnemonic };
        }

        this.wallet = new MeshWallet({
            networkId: this.networkId,
            fetcher: this.provider,
            submitter: this.provider,
            key: walletKey,
        });
    }

    /**
     * **Static function to generate a new wallet mnemonic**
     * @returns {string[]} The newly generated mnemonic.
     */
    static createWallet(): string[] {
        return MeshWallet.brew() as string[];
    }

    /**
     * Returns the wallet's mnemonic (if available).
     */
    getMnemonic(): string[] | undefined {
        return this.mnemonic;
    }

    /**
     * Returns the wallet's private key (if available, in Bech32 format).
     */
    getPrivateKey(): string | undefined {
        return this.privateKey;
    }


    /**
     * Returns the wallet's address.
     */
    async getAddress(): Promise<string> {
        if (!this.wallet) throw new Error("Wallet not initialized");
        try {
            const usedAddresses = await this.wallet.getUsedAddresses();
            if (usedAddresses.length > 0) return usedAddresses[0];

            // ✅ Try fetching an unused address
            const unusedAddresses = await this.wallet.getUnusedAddresses();
            if (unusedAddresses.length > 0) return unusedAddresses[0];

            throw new Error("No addresses found. Try receiving funds first.");
        } catch (error) {
            throw new Error("Error fetching wallet address: " + error);
        }
    }

    /**
     * Fetches all assets in the connected wallet, including details.
     * Returns an array of objects, each containing:
     * - `unit`: Asset identifier (e.g., "lovelace" for ADA)
     * - `quantity`: Amount held in the wallet
     * - `policyId`: The policy ID of the asset
     * - `assetName`: The human-readable name of the asset
     * - `metadata`: Metadata containing asset details (if available)
     */
    async getBalance(): Promise<
        any[]
    > {
        if (!this.wallet) throw new Error("Wallet not initialized");

        try {
            const balance = await this.wallet.getBalance();

            if (!Array.isArray(balance)) {
                return []; // ✅ Return empty array if response is invalid
            }

            // ✅ Fetch metadata for non-ADA assets
            const detailedAssets = await Promise.all(
                balance.map(async (asset) => {
                    if (asset.unit === "lovelace") {
                        return { ...asset, policyId: null, assetName: "ADA", metadata: null };
                    }

                    // ✅ Extract Policy ID and Asset Name
                    const policyId = asset.unit.slice(0, 56); // First 56 characters
                    const assetNameHex = asset.unit.slice(56); // Remaining part
                    const assetName = Buffer.from(assetNameHex, "hex").toString("utf-8");

                    // ✅ Fetch metadata if available
                    let metadata = null;
                    try {
                        metadata = await this.provider.fetchAssetMetadata(asset.unit);
                    } catch (error) {
                        console.warn(`No metadata found for ${asset.unit}`);
                    }

                    return { ...asset, policyId, assetName, metadata };
                })
            );

            return detailedAssets;
        } catch (error) {
            throw new Error(`Error fetching balance: ${(error as Error).message}`);
        }
    }


    /**
     * Signs and submits a transaction.
     * @param txHex The raw transaction hex string.
     */
    async signAndSendTx(txHex: string): Promise<string> {
        if (!this.wallet) throw new Error("Wallet not initialized");

        try {
            const txHash = await this.wallet.signTx(txHex);
            return txHash;
        } catch (error) {
            throw new Error(`Error signing transaction: ${(error as Error).message}`);
        }
    }

    /**
     * **Send ADA (Lovelace) to a recipient.**
     * @param recipientAddress The recipient's wallet address.
     * @param amountLovelace Amount in **Lovelace** (1 ADA = 1,000,000 Lovelace).
     * @returns The transaction hash.
     */
    async sendLovelace(recipientAddress: string, amountLovelace: string): Promise<string> {
        if (!this.wallet) throw new Error("Wallet not initialized");

        try {
            // ✅ Get sender address
            const senderAddress = await this.getAddress();

            // ✅ Build the transaction
            const tx = new Transaction({ initiator: this.wallet })
                .sendLovelace(recipientAddress, amountLovelace)
                .setChangeAddress(senderAddress);

            // ✅ Sign and submit transaction
            const unsignedTx = await tx.build();
            const signedTx = await this.wallet.signTx(unsignedTx);
            const txHash = await this.wallet.submitTx(signedTx);

            return txHash;
        } catch (error) {
            console.error("Detailed Transaction Error:", error); // ✅ Print full error
            throw new Error(`Error sending ADA: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        }
    }

    /**
       * **Registers a stake address and delegates to a stake pool**
       * @param poolId - The stake pool ID to delegate to
       * @returns The transaction hash
       */
    async registerAndStakeADA(poolId: string): Promise<string> {
        if (!this.wallet) throw new Error("Wallet not initialized");

        try {
            console.log("🔍 Fetching reward (stake) address...");
            const rewardAddresses = await this.wallet.getRewardAddresses();
            if (!rewardAddresses || rewardAddresses.length === 0) {
                throw new Error("No reward address found. Ensure this wallet supports staking.");
            }
            const rewardAddress = rewardAddresses[0];

            // ✅ Ensure it is a valid `stake_test1...` address
            if (!rewardAddress.startsWith("stake")) {
                throw new Error(`Invalid stake address! Expected 'stake_test1...', got: ${rewardAddress}`);
            }

            console.log("✅ Valid Reward Address:", rewardAddress);

            console.log("🔎 Checking if stake address is registered...");
            const accountInfo = await this.provider.fetchAccountInfo(rewardAddress);
            console.log("Account Info:", accountInfo);

            const tx = new Transaction({ initiator: this.wallet });

            if (!accountInfo || !accountInfo.active) {
                console.log("🚀 Stake address is NOT registered. Registering...");
                tx.registerStake(rewardAddress);
            } else {
                console.log("✅ Stake address is ALREADY registered.");
            }

            console.log("🔗 Delegating to stake pool:", poolId);

            // ✅ Ensure rewardAddress is being correctly passed to delegateStake()
            tx.delegateStake(rewardAddress, poolId);

            console.log("⚙️ Building unsigned transaction...");
            const unsignedTx = await tx.build();
            console.log("📝 Unsigned Transaction:", unsignedTx);

            console.log("🔑 Signing transaction...");
            const signedTx = await this.wallet.signTx(unsignedTx);
            console.log("✅ Signed Transaction:", signedTx);

            console.log("📤 Submitting transaction...");
            const txHash = await this.wallet.submitTx(signedTx);
            console.log("✅ Stake Transaction Hash:", txHash);

            return txHash;
        } catch (error) {
            console.error("🔥 Staking Error:", error);
            throw new Error(`Error staking ADA: ${(error as Error).message}`);
        }
    }

    /**
      * **Mint an Asset (NFT or Token)**
      * @param assetName - The name of the asset (NFT or token)
      * @param assetQuantity - The quantity to mint (default 1 for NFTs)
      * @param recipient - The recipient's Cardano address
      * @param metadata - Metadata including name, image, mediaType, and description
      * @param label - "721" for NFTs, "20" for fungible tokens (default: "721")
      * @returns The transaction hash
      */
    async mintAsset(
        assetName: string,
        assetQuantity: string = "1",
        recipient: string,
        metadata: {
            name: string;
            image: string;
            mediaType: string;
            description: string | string[];
        },
        label: "721" | "20" = "721"
    ): Promise<string> {
        if (!this.wallet) throw new Error("Wallet not initialized");

        const address = await this.getAddress();
        const forgingScript = ForgeScript.withOneSignature(address);

        const asset: Mint = {
            assetName,
            assetQuantity,
            metadata,
            label,
            recipient,
        };

        const tx = new Transaction({ initiator: this.wallet }).mintAsset(forgingScript, asset);
        const unsignedTx = await tx.build();
        const signedTx = await this.wallet.signTx(unsignedTx);
        return await this.wallet.submitTx(signedTx);
    }


    /**
     * **Burn an asset (NFT or token) from the wallet**
     * @param assetUnit - The asset unit to burn
     * @param quantity - The quantity of the asset to burn
     * @returns {Promise<string>} - The transaction hash
     */
    async burnAsset(assetUnit: string, quantity: string): Promise<string> {
        if (!this.wallet) throw new Error("Wallet not initialized");

        const address = await this.getAddress();
        const forgingScript = ForgeScript.withOneSignature(address);

        const asset: Asset = { unit: assetUnit, quantity };

        const tx = new Transaction({ initiator: this.wallet }).burnAsset(forgingScript, asset);
        const unsignedTx = await tx.build();
        const signedTx = await this.wallet.signTx(unsignedTx);
        return await this.wallet.submitTx(signedTx);
    }

    async sendAsset(
        recipientAddress: string,
        assetUnit: string,
        assetQuantity: string
    ): Promise<string> {
        if (!this.wallet) throw new Error("Wallet not initialized");

        try {
            // ✅ Get sender address
            const senderAddress = await this.getAddress();

            // ✅ Build the transaction
            const tx = new Transaction({ initiator: this.wallet })
                .sendAssets(recipientAddress, [{ unit: assetUnit, quantity: assetQuantity }])
                .setChangeAddress(senderAddress);

            // ✅ Sign and submit transaction
            const unsignedTx = await tx.build();
            const signedTx = await this.wallet.signTx(unsignedTx);
            const txHash = await this.wallet.submitTx(signedTx);

            return txHash;
        } catch (error) {
            console.error("🔥 Error transferring asset:", error);
            throw new Error(`Error sending asset: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        }
    }

    /**
     * **Fetches the transaction history of the connected wallet.**
     * @returns {Promise<any[]>} - Array of transactions with `from` and `to` details.
     */
    async getTransactionHistory(): Promise<
        any[]
    > {
        if (!this.wallet) throw new Error("Wallet not initialized");

        try {
            console.log("🔍 Fetching wallet address...");
            const address = await this.getAddress();
            console.log("✅ Wallet Address:", address);

            if (!(this.provider instanceof BlockfrostProvider)) {
                throw new Error("Transaction history is only supported with Blockfrost.");
            }

            console.log("🔍 Fetching transaction history using Blockfrost...");
            const transactions = await this.provider.fetchAddressTransactions(address);

            if (!transactions || transactions.length === 0) {
                console.log("ℹ️ No transactions found.");
                return [];
            }

            console.log(`✅ Found ${transactions.length} transactions. Fetching details...`);

            // ✅ Fetch full transaction details
            const detailedTransactions = await Promise.all(
                transactions.map(async (tx) => {
                    const info = await this.provider.fetchTxInfo(tx.hash);
                    const utxos = await this.provider.fetchUTxOs(tx.hash);
                    return {
                        ...info, utxos
                    };
                })
            );

            console.log("✅ Transactions with mapped details fetched:", detailedTransactions);
            return detailedTransactions;
        } catch (error) {
            console.error("🔥 Error fetching transaction history:", error);
            throw new Error(`Error fetching transaction history: ${(error as Error).message}`);
        }
    }

}
