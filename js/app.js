/* ==========================================
   APP.JS - Main Application Logic
   Connects all components and handles events
   ========================================== */

const App = {
    currentWallet: null,
    currentPin: null,
    backupPhrase: null,
    hasUSDCTrustline: false,
    isDemoMode: false,

    /**
     * Initialize application
     */
    init: function() {
        console.log('Pocket Wallet initializing...');
        
        // Check if wallet exists
        if (Storage.walletExists()) {
            // TODO: Show unlock screen
            UI.showScreen('screen-landing');
        } else {
            UI.showScreen('screen-landing');
        }
        
        this.attachEventListeners();
    },

    /**
     * Attach all event listeners
     */
    attachEventListeners: function() {
        // Landing screen
        document.getElementById('btn-create-wallet').addEventListener('click', () => {
            UI.showScreen('screen-pin-setup');
            this.setupPinInput();
        });

        // Demo mode button
        document.getElementById('btn-demo-mode').addEventListener('click', () => {
            this.startDemoMode();
        });

        // PIN setup
        document.getElementById('btn-back-pin').addEventListener('click', () => {
            UI.showScreen('screen-landing');
        });

        document.getElementById('btn-confirm-pin').addEventListener('click', () => {
            this.createWallet();
        });

        // Backup screen
        document.getElementById('backup-confirm').addEventListener('change', (e) => {
            document.getElementById('btn-finish-setup').disabled = !e.target.checked;
        });

        document.getElementById('btn-finish-setup').addEventListener('click', () => {
            this.finishSetup();
        });

        // Dashboard
        document.getElementById('btn-refresh').addEventListener('click', () => {
            this.refreshBalance();
        });

        document.getElementById('btn-send').addEventListener('click', () => {
            UI.showScreen('screen-send');
        });

        document.getElementById('btn-receive').addEventListener('click', () => {
            this.showReceive();
        });

        document.getElementById('btn-topup').addEventListener('click', () => {
            this.showReceive();
        });

        document.getElementById('btn-menu').addEventListener('click', () => {
            UI.showScreen('screen-menu');
        });

        // USDC Trustline button
        const btnAddUSDC = document.getElementById('btn-add-usdc');
        if (btnAddUSDC) {
            btnAddUSDC.addEventListener('click', () => {
                this.addUSDCTrustline();
            });
        }

        // Send screen
        document.getElementById('btn-back-send').addEventListener('click', () => {
            UI.showScreen('screen-dashboard');
        });

        document.getElementById('send-address').addEventListener('input', () => {
            UI.validateSendForm();
        });

        document.getElementById('send-amount').addEventListener('input', () => {
            UI.validateSendForm();
        });

        document.getElementById('btn-confirm-send').addEventListener('click', () => {
            this.sendPayment();
        });

        // Asset selector for send (XLM vs USDC)
        const assetSelector = document.getElementById('send-asset');
        if (assetSelector) {
            assetSelector.addEventListener('change', () => {
                UI.validateSendForm();
            });
        }

        // Receive screen
        document.getElementById('btn-back-receive').addEventListener('click', () => {
            UI.showScreen('screen-dashboard');
        });

        document.getElementById('btn-copy-address').addEventListener('click', () => {
            UI.copyToClipboard(this.currentWallet.publicKey);
        });

        // Menu screen
        document.getElementById('btn-back-menu').addEventListener('click', () => {
            UI.showScreen('screen-dashboard');
        });

        document.getElementById('menu-logout').addEventListener('click', () => {
            this.logout();
        });

        // Exit demo mode
        const exitDemoBtn = document.getElementById('btn-exit-demo');
        if (exitDemoBtn) {
            exitDemoBtn.addEventListener('click', () => {
                this.exitDemoMode();
            });
        }
    },

    /**
     * Setup PIN input with auto-focus
     */
    setupPinInput: function() {
        const pinInputs = document.querySelectorAll('.pin-digit');
        
        pinInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (e.target.value.length === 1) {
                    // Move to next input
                    if (index < pinInputs.length - 1) {
                        pinInputs[index + 1].focus();
                    }
                }
                
                // Check if all filled
                const allFilled = Array.from(pinInputs).every(inp => inp.value.length === 1);
                document.getElementById('btn-confirm-pin').disabled = !allFilled;
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                    pinInputs[index - 1].focus();
                }
            });
        });

        // Focus first input
        pinInputs[0].focus();
    },

    /**
     * Get PIN from inputs
     */
    getPin: function() {
        const pinInputs = document.querySelectorAll('.pin-digit');
        return Array.from(pinInputs).map(input => input.value).join('');
    },

    /**
     * Create new wallet
     */
    createWallet: async function() {
        UI.showLoading('Creating wallet...');
        
        try {
            // Get PIN
            const pin = this.getPin();
            this.currentPin = pin;
            
            // Generate keypair
            const keypair = Stellar.generateKeypair();
            this.currentWallet = keypair;
            
            // Generate backup phrase
            this.backupPhrase = Stellar.generateMnemonic();
            
            // Save to storage
            Storage.saveWallet(keypair.secretKey, keypair.publicKey, pin);
            
            // Fund account (testnet only)
            if (Stellar.network === 'testnet') {
                await Stellar.fundAccount(keypair.publicKey);
            }
            
            // Show backup screen
            UI.hideLoading();
            UI.displayBackupPhrase(this.backupPhrase);
            UI.showScreen('screen-backup');
            
        } catch (error) {
            UI.hideLoading();
            UI.showAlert('Failed to create wallet: ' + error.message, true);
            console.error(error);
        }
    },

    /**
     * Finish setup and go to dashboard
     */
    finishSetup: function() {
        UI.showScreen('screen-dashboard');
        this.loadDashboard();
    },

    /**
     * Load dashboard data
     */
    loadDashboard: async function() {
        if (!this.currentWallet) {
            UI.showAlert('No wallet loaded', true);
            return;
        }

        try {
            // Check USDC trustline status
            await this.checkUSDCStatus();
            
            // Load balance
            await this.refreshBalance();
            
            // Load transactions
            const transactions = await Stellar.getTransactions(this.currentWallet.publicKey);
            UI.updateTransactions(transactions);
            
        } catch (error) {
            console.error('Load dashboard error:', error);
        }
    },

    /**
     * Check USDC trustline status
     */
    checkUSDCStatus: async function() {
        if (!this.currentWallet) return;

        try {
            this.hasUSDCTrustline = await Stellar.hasUSDCTrustline(this.currentWallet.publicKey);
            UI.updateUSDCStatus(this.hasUSDCTrustline);
        } catch (error) {
            console.error('Check USDC status error:', error);
            this.hasUSDCTrustline = false;
        }
    },

    /**
     * Add USDC Trustline
     */
    addUSDCTrustline: async function() {
        if (!this.currentWallet) {
            UI.showAlert('No wallet loaded', true);
            return;
        }

        if (this.hasUSDCTrustline) {
            UI.showAlert('USDC is already enabled on your wallet');
            return;
        }

        // Confirm action
        const confirmed = confirm(
            'Add USDC to your wallet?\n\n' +
            'This will:\n' +
            '• Reserve 0.5 XLM from your balance\n' +
            '• Allow you to receive and send USDC\n' +
            '• Cost a small network fee (~0.00001 XLM)'
        );

        if (!confirmed) return;

        UI.showLoading('Adding USDC trustline...');

        try {
            await Stellar.createUSDCTrustline(this.currentWallet.secretKey);
            
            UI.hideLoading();
            UI.showAlert('USDC enabled successfully! You can now receive and send USDC.');
            
            // Refresh status and balance
            await this.checkUSDCStatus();
            await this.refreshBalance();
            
        } catch (error) {
            UI.hideLoading();
            
            let errorMsg = 'Failed to add USDC: ';
            if (error.message.includes('already exists')) {
                errorMsg += 'USDC is already enabled';
            } else if (error.message.includes('insufficient')) {
                errorMsg += 'Insufficient XLM balance. You need at least 0.5 XLM.';
            } else {
                errorMsg += error.message;
            }
            
            UI.showAlert(errorMsg, true);
            console.error(error);
        }
    },

    /**
     * Refresh balance
     */
    refreshBalance: async function() {
        if (!this.currentWallet) return;

        UI.showLoading('Updating balance...');
        
        try {
            const balances = await Stellar.getBalance(this.currentWallet.publicKey);
            UI.updateBalance(balances);
            UI.hideLoading();
        } catch (error) {
            UI.hideLoading();
            console.error('Refresh balance error:', error);
        }
    },

    /**
     * Show receive screen
     */
    showReceive: function() {
        if (!this.currentWallet) return;
        
        UI.showScreen('screen-receive');
        UI.displayAddress(this.currentWallet.publicKey);
    },

    /**
     * Send payment
     */
    sendPayment: async function() {
        const address = document.getElementById('send-address').value;
        const amount = document.getElementById('send-amount').value;
        const memo = document.getElementById('send-memo').value;
        
        // Get selected asset (XLM or USDC)
        const assetSelector = document.getElementById('send-asset');
        const asset = assetSelector ? assetSelector.value : 'XLM';
        
        // Validate
        if (!Stellar.isValidAddress(address) && !this.isDemoMode) {
            UI.showAlert('Invalid recipient address', true);
            return;
        }
        
        if (parseFloat(amount) <= 0) {
            UI.showAlert('Amount must be greater than 0', true);
            return;
        }

        // Check if sending USDC without trustline
        if (asset === 'USDC' && !this.hasUSDCTrustline) {
            UI.showAlert('You need to add USDC trustline first', true);
            return;
        }

        // DEMO MODE: Fake transaction
        if (this.isDemoMode) {
            UI.showLoading(`Sending ${asset}...`);
            
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            UI.hideLoading();
            UI.showAlert(`🎭 Demo: ${amount} ${asset} sent successfully! (Not a real transaction)`);
            
            // Clear form
            document.getElementById('send-address').value = '';
            document.getElementById('send-amount').value = '';
            document.getElementById('send-memo').value = '';
            
            // Update fake balance
            const currentBalances = {
                XLM: asset === 'XLM' ? 10.5 - parseFloat(amount) : 10.5,
                USDC: asset === 'USDC' ? 15.00 - parseFloat(amount) : 15.00
            };
            UI.updateBalance(currentBalances);
            
            // Return to dashboard
            UI.showScreen('screen-dashboard');
            return;
        }

        UI.showLoading(`Sending ${asset}...`);
        
        try {
            await Stellar.sendPayment(
                this.currentWallet.secretKey,
                address,
                amount,
                asset,
                memo
            );
            
            UI.hideLoading();
            UI.showAlert(`${asset} sent successfully!`);
            
            // Clear form
            document.getElementById('send-address').value = '';
            document.getElementById('send-amount').value = '';
            document.getElementById('send-memo').value = '';
            
            // Return to dashboard and refresh
            UI.showScreen('screen-dashboard');
            await this.refreshBalance();
            
        } catch (error) {
            UI.hideLoading();
            
            let errorMsg = 'Payment failed: ';
            if (error.message.includes('trustline')) {
                errorMsg += 'Recipient does not have USDC enabled';
            } else if (error.message.includes('insufficient')) {
                errorMsg += 'Insufficient balance';
            } else {
                errorMsg += error.message;
            }
            
            UI.showAlert(errorMsg, true);
            console.error(error);
        }
    },

    /**
     * Start Demo Mode
     */
    startDemoMode: function() {
        this.isDemoMode = true;
        
        // Create fake wallet
        this.currentWallet = {
            publicKey: 'DEMO_G' + 'A'.repeat(55),
            secretKey: 'DEMO_S' + 'A'.repeat(55)
        };
        
        // Set demo state
        this.hasUSDCTrustline = true;
        
        // Show dashboard
        UI.showScreen('screen-dashboard');
        UI.showDemoBanner();
        
        // Load fake demo data
        this.loadDemoData();
        
        UI.showAlert('🎭 Welcome to Demo Mode! Explore with fake data. No real transactions.');
    },

    /**
     * Load fake demo data
     */
    loadDemoData: function() {
        // Fake balances
        const demoBalances = {
            XLM: 10.5000000,
            USDC: 15.00
        };
        
        UI.updateBalance(demoBalances);
        UI.updateUSDCStatus(true);
        
        // Fake transactions
        const demoTransactions = [
            {
                created_at: new Date(Date.now() - 86400000).toISOString(),
                memo: 'Coffee at Starbucks'
            },
            {
                created_at: new Date(Date.now() - 172800000).toISOString(),
                memo: 'Lunch payment'
            },
            {
                created_at: new Date(Date.now() - 259200000).toISOString(),
                memo: 'Top up from LOBSTR'
            }
        ];
        
        UI.updateTransactions(demoTransactions);
    },

    /**
     * Exit Demo Mode
     */
    exitDemoMode: function() {
        if (confirm('Exit demo mode and return to landing page?')) {
            this.isDemoMode = false;
            this.currentWallet = null;
            this.hasUSDCTrustline = false;
            UI.hideDemoBanner();
            UI.showScreen('screen-landing');
        }
    },

    /**
     * Logout
     */
    logout: function() {
        if (confirm('Lock wallet? You will need your PIN to access it again.')) {
            this.currentWallet = null;
            this.currentPin = null;
            this.hasUSDCTrustline = false;
            UI.showScreen('screen-landing');
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
