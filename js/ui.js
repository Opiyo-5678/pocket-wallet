/* ==========================================
   UI.JS - User Interface Management
   Handles screen navigation and UI updates
   ========================================== */

const UI = {
    /**
     * Show specific screen
     */
    showScreen: function(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    },

    /**
     * Show loading overlay
     */
    showLoading: function(text = 'Processing...') {
        document.getElementById('loading-text').textContent = text;
        document.getElementById('loading-overlay').classList.remove('hidden');
    },

    /**
     * Hide loading overlay
     */
    hideLoading: function() {
        document.getElementById('loading-overlay').classList.add('hidden');
    },

    /**
     * Show alert (simple alert for now)
     */
    showAlert: function(message, isError = false) {
        alert(message);
    },

    /**
     * Update balance display with XLM and USDC
     */
    updateBalance: function(balances, xlmPrice = 0.10) {
        // Calculate USD value (mock price, will integrate real API later)
        let totalUSD = 0;
        
        // XLM Balance
        if (balances.XLM) {
            totalUSD += balances.XLM * xlmPrice;
            document.getElementById('balance-xlm').textContent = 
                `${Stellar.formatAmount(balances.XLM)} XLM`;
        } else {
            document.getElementById('balance-xlm').textContent = '0 XLM';
        }
        
        // USDC Balance
        const usdcBalanceEl = document.getElementById('balance-usdc');
        if (usdcBalanceEl) {
            if (balances.USDC) {
                totalUSD += balances.USDC;
                usdcBalanceEl.textContent = `${Stellar.formatUSDC(balances.USDC)} USDC`;
                usdcBalanceEl.classList.remove('hidden');
            } else {
                usdcBalanceEl.textContent = '0.00 USDC';
                // Only show if trustline exists (will be updated by updateUSDCStatus)
            }
        }
        
        // Total USD value
        document.getElementById('balance-usd').textContent = 
            `$${totalUSD.toFixed(2)}`;
        
        // Show warning if approaching limit
        const limitWarning = document.getElementById('limit-warning');
        if (limitWarning) {
            if (totalUSD > 40) {
                limitWarning.classList.remove('hidden');
            } else {
                limitWarning.classList.add('hidden');
            }
        }
        
        // Update send screen available balance
        this.updateSendAvailableBalance(balances);
    },

    /**
     * Update available balance in send screen based on selected asset
     */
    updateSendAvailableBalance: function(balances) {
        const sendAvailableEl = document.getElementById('send-available');
        if (!sendAvailableEl) return;

        const assetSelector = document.getElementById('send-asset');
        const selectedAsset = assetSelector ? assetSelector.value : 'XLM';

        if (selectedAsset === 'USDC') {
            sendAvailableEl.textContent = 
                `${Stellar.formatUSDC(balances.USDC || 0)} USDC`;
        } else {
            sendAvailableEl.textContent = 
                `${Stellar.formatAmount(balances.XLM || 0)} XLM`;
        }
    },

    /**
     * Update USDC status on dashboard
     */
    updateUSDCStatus: function(hasUSDCTrustline) {
        const addUSDCBtn = document.getElementById('btn-add-usdc');
        const usdcBalanceEl = document.getElementById('balance-usdc');
        const usdcStatusEl = document.getElementById('usdc-status');
        
        if (hasUSDCTrustline) {
            // Hide "Add USDC" button
            if (addUSDCBtn) {
                addUSDCBtn.classList.add('hidden');
            }
            
            // Show USDC balance
            if (usdcBalanceEl) {
                usdcBalanceEl.classList.remove('hidden');
            }
            
            // Update status indicator
            if (usdcStatusEl) {
                usdcStatusEl.textContent = '✓ USDC Enabled';
                usdcStatusEl.className = 'usdc-status enabled';
            }
            
            // Enable USDC in send asset selector
            const assetSelector = document.getElementById('send-asset');
            if (assetSelector) {
                const usdcOption = assetSelector.querySelector('option[value="USDC"]');
                if (usdcOption) {
                    usdcOption.disabled = false;
                }
            }
        } else {
            // Show "Add USDC" button
            if (addUSDCBtn) {
                addUSDCBtn.classList.remove('hidden');
            }
            
            // Hide USDC balance
            if (usdcBalanceEl) {
                usdcBalanceEl.classList.add('hidden');
            }
            
            // Update status indicator
            if (usdcStatusEl) {
                usdcStatusEl.textContent = 'USDC Not Enabled';
                usdcStatusEl.className = 'usdc-status disabled';
            }
            
            // Disable USDC in send asset selector
            const assetSelector = document.getElementById('send-asset');
            if (assetSelector) {
                const usdcOption = assetSelector.querySelector('option[value="USDC"]');
                if (usdcOption) {
                    usdcOption.disabled = true;
                }
                // Switch to XLM if USDC was selected
                if (assetSelector.value === 'USDC') {
                    assetSelector.value = 'XLM';
                }
            }
        }
    },

    /**
     * Update transaction list
     */
    updateTransactions: function(transactions) {
        const listEl = document.getElementById('transaction-list');
        
        if (transactions.length === 0) {
            listEl.innerHTML = '<p class="empty-state">No transactions yet</p>';
            return;
        }
        
        listEl.innerHTML = '';
        
        transactions.forEach(tx => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            
            // Parse transaction type (simplified)
            const type = tx.memo ? 'Payment' : 'Transaction';
            const date = new Date(tx.created_at).toLocaleDateString();
            
            item.innerHTML = `
                <div class="transaction-info">
                    <div class="transaction-type">${type}</div>
                    <div class="transaction-date">${date}</div>
                </div>
                <div class="transaction-amount">View</div>
            `;
            
            listEl.appendChild(item);
        });
    },

    /**
     * Display wallet address with QR code
     */
    displayAddress: function(publicKey) {
        document.getElementById('wallet-address').textContent = publicKey;
        
        // Generate QR code
        const qrContainer = document.getElementById('qr-code');
        qrContainer.innerHTML = ''; // Clear previous QR
        
        new QRCode(qrContainer, {
            text: publicKey,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff',
        });
    },

    /**
     * Copy text to clipboard
     */
    copyToClipboard: function(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showAlert('Address copied to clipboard');
            }).catch(() => {
                this.showAlert('Failed to copy address', true);
            });
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showAlert('Address copied to clipboard');
        }
    },

    /**
     * Validate send form inputs
     */
    validateSendForm: function() {
        const address = document.getElementById('send-address').value;
        const amount = document.getElementById('send-amount').value;
        const assetSelector = document.getElementById('send-asset');
        const asset = assetSelector ? assetSelector.value : 'XLM';
        
        const isValid = 
            address.length > 0 && 
            Stellar.isValidAddress(address) &&
            parseFloat(amount) > 0;
        
        document.getElementById('btn-confirm-send').disabled = !isValid;
        
        // Update USD estimate
        if (parseFloat(amount) > 0) {
            let usd = 0;
            if (asset === 'USDC') {
                usd = parseFloat(amount); // USDC is 1:1 with USD
            } else {
                usd = parseFloat(amount) * 0.10; // XLM mock price
            }
            document.getElementById('send-amount-usd').textContent = `≈ $${usd.toFixed(2)}`;
        } else {
            document.getElementById('send-amount-usd').textContent = '≈ $0.00';
        }
    },

    /**
     * Display backup phrase
     */
    displayBackupPhrase: function(phrase) {
        const words = phrase.split(' ');
        const container = document.getElementById('backup-phrase');
        container.innerHTML = '';
        
        words.forEach((word, index) => {
            const wordEl = document.createElement('div');
            wordEl.className = 'backup-word';
            wordEl.textContent = `${index + 1}. ${word}`;
            container.appendChild(wordEl);
        });
    },

    /**
     * Initialize asset selector listener
     */
    initAssetSelector: function() {
        const assetSelector = document.getElementById('send-asset');
        if (assetSelector) {
            assetSelector.addEventListener('change', () => {
                this.validateSendForm();
                // Update available balance when asset changes
                if (App.currentWallet) {
                    Stellar.getBalance(App.currentWallet.publicKey).then(balances => {
                        this.updateSendAvailableBalance(balances);
                    });
                }
            });
        }
    },

    /**
     * Show demo mode banner
     */
    showDemoBanner: function() {
        const banner = document.getElementById('demo-banner');
        if (banner) {
            banner.classList.remove('hidden');
        }
    },

    /**
     * Hide demo mode banner
     */
    hideDemoBanner: function() {
        const banner = document.getElementById('demo-banner');
        if (banner) {
            banner.classList.add('hidden');
        }
    }
};
