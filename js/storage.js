/* ==========================================
   STORAGE.JS - Encrypted Local Storage
   Handles secure storage with PIN encryption
   ========================================== */

const Storage = {
    /**
     * Save encrypted wallet data
     */
    saveWallet: function(secretKey, publicKey, pin) {
        try {
            const walletData = {
                secretKey: secretKey,
                publicKey: publicKey,
                created: Date.now()
            };
            
            // Encrypt with PIN
            const encrypted = CryptoJS.AES.encrypt(
                JSON.stringify(walletData),
                pin
            ).toString();
            
            localStorage.setItem('pocket_wallet', encrypted);
            localStorage.setItem('pocket_wallet_exists', 'true');
            return true;
        } catch (error) {
            console.error('Save wallet error:', error);
            return false;
        }
    },

    /**
     * Load and decrypt wallet data
     */
    loadWallet: function(pin) {
        try {
            const encrypted = localStorage.getItem('pocket_wallet');
            if (!encrypted) return null;
            
            // Decrypt with PIN
            const decrypted = CryptoJS.AES.decrypt(encrypted, pin);
            const walletData = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
            
            return walletData;
        } catch (error) {
            console.error('Load wallet error:', error);
            return null;
        }
    },

    /**
     * Check if wallet exists
     */
    walletExists: function() {
        return localStorage.getItem('pocket_wallet_exists') === 'true';
    },

    /**
     * Delete wallet (logout)
     */
    deleteWallet: function() {
        localStorage.removeItem('pocket_wallet');
        localStorage.removeItem('pocket_wallet_exists');
        localStorage.removeItem('pocket_wallet_settings');
    },

    /**
     * Save settings
     */
    saveSettings: function(settings) {
        localStorage.setItem('pocket_wallet_settings', JSON.stringify(settings));
    },

    /**
     * Load settings
     */
    loadSettings: function() {
        const settings = localStorage.getItem('pocket_wallet_settings');
        return settings ? JSON.parse(settings) : {
            network: 'testnet',
            tokens: ['XLM']
        };
    }
};
