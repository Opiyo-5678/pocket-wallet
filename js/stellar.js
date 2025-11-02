/* ==========================================
   STELLAR.JS - Stellar Network Integration
   Handles all blockchain interactions
   ========================================== */

const Stellar = {
    server: null,
    network: 'testnet',
    
    // USDC Issuer Addresses
    USDC_ISSUERS: {
        testnet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        mainnet: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    },
    
    /**
     * Initialize Stellar connection
     */
    init: function(network = 'testnet') {
        this.network = network;
        
        if (network === 'testnet') {
            this.server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
            StellarSdk.Networks.TESTNET;
        } else {
            this.server = new StellarSdk.Server('https://horizon.stellar.org');
            StellarSdk.Networks.PUBLIC;
        }
    },

    /**
     * Generate new keypair
     */
    generateKeypair: function() {
        const pair = StellarSdk.Keypair.random();
        return {
            publicKey: pair.publicKey(),
            secretKey: pair.secret()
        };
    },

    /**
     * Generate mnemonic (12-word backup phrase)
     */
    generateMnemonic: function() {
        // Simple 12-word generation (for production, use BIP39)
        const words = [
            'apple', 'banana', 'cherry', 'dragon', 'eagle', 'falcon',
            'grape', 'honey', 'island', 'jungle', 'kitten', 'lemon',
            'mango', 'night', 'ocean', 'piano', 'queen', 'river',
            'sunset', 'tiger', 'unique', 'violet', 'wonder', 'yellow'
        ];
        
        const mnemonic = [];
        for (let i = 0; i < 12; i++) {
            mnemonic.push(words[Math.floor(Math.random() * words.length)]);
        }
        return mnemonic.join(' ');
    },

    /**
     * Fund account (testnet only)
     */
    fundAccount: async function(publicKey) {
        if (this.network !== 'testnet') {
            throw new Error('Funding only available on testnet');
        }
        
        try {
            const response = await fetch(
                `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
            );
            return await response.json();
        } catch (error) {
            console.error('Fund account error:', error);
            throw error;
        }
    },

    /**
     * Load account from network
     */
    loadAccount: async function(publicKey) {
        try {
            return await this.server.loadAccount(publicKey);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new Error('Account not found. Fund it first.');
            }
            throw error;
        }
    },

    /**
     * Get account balance
     */
    getBalance: async function(publicKey) {
        try {
            const account = await this.loadAccount(publicKey);
            const balances = {};
            
            account.balances.forEach(balance => {
                if (balance.asset_type === 'native') {
                    balances.XLM = parseFloat(balance.balance);
                } else {
                    const assetCode = balance.asset_code;
                    balances[assetCode] = parseFloat(balance.balance);
                }
            });
            
            return balances;
        } catch (error) {
            console.error('Get balance error:', error);
            return { XLM: 0 };
        }
    },

    /**
     * Check if account has USDC trustline
     */
    hasUSDCTrustline: async function(publicKey) {
        try {
            const account = await this.loadAccount(publicKey);
            const usdcIssuer = this.USDC_ISSUERS[this.network];
            
            return account.balances.some(balance => 
                balance.asset_code === 'USDC' && 
                balance.asset_issuer === usdcIssuer
            );
        } catch (error) {
            console.error('Check USDC trustline error:', error);
            return false;
        }
    },

    /**
     * Get USDC balance
     */
    getUSDCBalance: async function(publicKey) {
        try {
            const balances = await this.getBalance(publicKey);
            return balances.USDC || 0;
        } catch (error) {
            console.error('Get USDC balance error:', error);
            return 0;
        }
    },

    /**
     * Create USDC trustline
     */
    createUSDCTrustline: async function(secretKey) {
        try {
            const usdcIssuer = this.USDC_ISSUERS[this.network];
            
            // Check if trustline already exists
            const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
            const hasTrustline = await this.hasUSDCTrustline(sourceKeypair.publicKey());
            
            if (hasTrustline) {
                throw new Error('USDC trustline already exists');
            }
            
            // Create the trustline
            const result = await this.createTrustline(secretKey, 'USDC', usdcIssuer);
            return result;
            
        } catch (error) {
            console.error('Create USDC trustline error:', error);
            throw error;
        }
    },

    /**
     * Send payment (supports XLM and USDC)
     */
    sendPayment: async function(secretKey, destination, amount, asset = 'XLM', memo = '') {
        try {
            const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
            const sourceAccount = await this.loadAccount(sourceKeypair.publicKey());
            
            // Determine asset
            let stellarAsset;
            if (asset === 'XLM') {
                stellarAsset = StellarSdk.Asset.native();
            } else if (asset === 'USDC') {
                const usdcIssuer = this.USDC_ISSUERS[this.network];
                stellarAsset = new StellarSdk.Asset('USDC', usdcIssuer);
                
                // Check if sender has USDC trustline
                const hasTrustline = await this.hasUSDCTrustline(sourceKeypair.publicKey());
                if (!hasTrustline) {
                    throw new Error('You need to add USDC trustline first');
                }
            } else {
                throw new Error(`Asset ${asset} not supported`);
            }
            
            // Build transaction
            const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.network === 'testnet' 
                    ? StellarSdk.Networks.TESTNET 
                    : StellarSdk.Networks.PUBLIC
            })
                .addOperation(
                    StellarSdk.Operation.payment({
                        destination: destination,
                        asset: stellarAsset,
                        amount: amount.toString()
                    })
                )
                .setTimeout(30);
            
            // Add memo if provided
            if (memo) {
                transaction.addMemo(StellarSdk.Memo.text(memo));
            }
            
            const builtTransaction = transaction.build();
            builtTransaction.sign(sourceKeypair);
            
            // Submit to network
            const result = await this.server.submitTransaction(builtTransaction);
            return result;
            
        } catch (error) {
            console.error('Send payment error:', error);
            throw error;
        }
    },

    /**
     * Get recent transactions
     */
    getTransactions: async function(publicKey, limit = 10) {
        try {
            const response = await this.server
                .transactions()
                .forAccount(publicKey)
                .limit(limit)
                .order('desc')
                .call();
            
            return response.records;
        } catch (error) {
            console.error('Get transactions error:', error);
            return [];
        }
    },

    /**
     * Create trustline for token (generic)
     */
    createTrustline: async function(secretKey, assetCode, issuerAddress) {
        try {
            const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
            const sourceAccount = await this.loadAccount(sourceKeypair.publicKey());
            
            const asset = new StellarSdk.Asset(assetCode, issuerAddress);
            
            const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.network === 'testnet' 
                    ? StellarSdk.Networks.TESTNET 
                    : StellarSdk.Networks.PUBLIC
            })
                .addOperation(
                    StellarSdk.Operation.changeTrust({
                        asset: asset
                    })
                )
                .setTimeout(30)
                .build();
            
            transaction.sign(sourceKeypair);
            
            const result = await this.server.submitTransaction(transaction);
            return result;
            
        } catch (error) {
            console.error('Create trustline error:', error);
            throw error;
        }
    },

    /**
     * Remove trustline (set limit to 0)
     */
    removeTrustline: async function(secretKey, assetCode, issuerAddress) {
        try {
            const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
            const sourceAccount = await this.loadAccount(sourceKeypair.publicKey());
            
            const asset = new StellarSdk.Asset(assetCode, issuerAddress);
            
            const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.network === 'testnet' 
                    ? StellarSdk.Networks.TESTNET 
                    : StellarSdk.Networks.PUBLIC
            })
                .addOperation(
                    StellarSdk.Operation.changeTrust({
                        asset: asset,
                        limit: '0'
                    })
                )
                .setTimeout(30)
                .build();
            
            transaction.sign(sourceKeypair);
            
            const result = await this.server.submitTransaction(transaction);
            return result;
            
        } catch (error) {
            console.error('Remove trustline error:', error);
            throw error;
        }
    },

    /**
     * Validate Stellar address
     */
    isValidAddress: function(address) {
        return StellarSdk.StrKey.isValidEd25519PublicKey(address);
    },

    /**
     * Format amount (7 decimal places for crypto)
     */
    formatAmount: function(amount) {
        return parseFloat(amount).toFixed(7).replace(/\.?0+$/, '');
    },

    /**
     * Format USDC amount (2 decimal places)
     */
    formatUSDC: function(amount) {
        return parseFloat(amount).toFixed(2);
    }
};

// Initialize with mainnet by default
Stellar.init('mainnet');