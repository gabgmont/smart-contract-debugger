'use server'

import path from 'path';
import fs from 'fs';

export async function getContracts() {
    const contractsDir = path.join(process.cwd(), 'public', 'contracts')
    const files = fs.readdirSync(contractsDir);
    console.log("Files: ", files)
    return files
}