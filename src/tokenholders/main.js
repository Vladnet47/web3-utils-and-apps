const KycManager = require('./kyc');

const HOLDER_PATH = '/home/vdog/workspace/private/web3-utils/src/tokenholders/csv/holders.csv';
const KYC_PATH = '/home/vdog/workspace/private/web3-utils/src/tokenholders/csv/kyc.csv';
const DB_HOST = '165.227.185.87';
const DB_PORT = 31017;
const DB_DATABASE = 'prodv2';

async function main() {
    const kycManager = new KycManager(KYC_PATH, DB_HOST, DB_PORT, DB_DATABASE);
    await kycManager.load();
    await kycManager.isKyc('0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C2d');
    await kycManager.isKyc('0x1D52798dCAd378582Ce1f5fC6607f1Bb070dCe40');
    await kycManager.save();
}

async function getHoldersIter(path) {
    
}



module.exports = main;