import * as multisig from "@sqds/multisig";
import {
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  clusterApiUrl,
} from "@solana/web3.js";
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import {
    createPostResponse,
} from "@solana/actions";
import { processUserKeys } from "../utils";
import { Member } from "@sqds/multisig/lib/generated";

const { Permission, Permissions } = multisig.types;
const connection = new Connection(clusterApiUrl("devnet"));

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

// Express app setup
const app: Express = express();
app.use(express.json());
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Encoding', 'Accept-Encoding'],
}));

// Routes
app.get('/actions.json', getActionsJson);
app.get('/api/actions/create-squad', getCreateSquad);
app.post('/api/actions/create-squad-direct', postCreateSquadDirect);
app.post('/api/actions/create-squad-group', postCreateSquadGroup);

// Route handlers
function getActionsJson(req:any, res:any) {
    const payload = {
      rules: [
        { pathPattern: "/*", apiPath: "/api/actions/*" },
        { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" },
      ],
    };
    res.json(payload);
}

//create multisig blink
async function getCreateSquad(req:any, res:any) {
    try {
      const baseHref = `${BASE_URL}/api/actions`;
      const payload = {
        title: "Create Squad",
        icon: "https://i.ibb.co/h2FtFm4/Blinks.png",
        description: "Create your group's squad in a blink!\nPlease enter the member public keys space separated.",
        links: {
          actions: [
            { label: "Create a squad, just with you!", href: `${baseHref}/create-squad-direct` },
            {
              label: "25% Threshold",
              href: `${baseHref}/create-squad-group?data={data}&threshold=25`,
              parameters: [
                { name: "data", label: "Enter the user keys, space separated.", required: true },
              ],
            },
            {
              label: "50% Threshold",
              href: `${baseHref}/create-squad-group?data={data}&threshold=50`,
              parameters: [
                { name: "data", label: "Enter the user keys, space separated.", required: true },
              ],
            },
            {
              label: "75% Threshold",
              href: `${baseHref}/create-squad-group?data={data}&threshold=75`,
              parameters: [
                { name: "data", label: "Enter the user keys, space separated.", required: true },
              ],
            },
            {
              label: "100% Threshold",
              href: `${baseHref}/create-squad-group?data={data}`,
              parameters: [
                { name: "data", label: "Enter the user keys, space separated.", required: true },
              ],
            },
          ],
        },
      };
  
      res.json(payload);
    } catch (err) {
      console.log(err)
      res.json(err);
    }
}

//create multisig post operations
async function postCreateSquadDirect(req:any, res:any) {
  try {
    const { account } = req.body;

    if (!account) {
      throw new Error('Invalid "account" provided');
    }

    const fromPubkey = new PublicKey(account);
    const minimumBalance = await connection.getMinimumBalanceForRentExemption(0);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const createKey = Keypair.generate();
    // Derive the multisig account PDA
    const [multisigPda] = multisig.getMultisigPda({
          createKey: createKey.publicKey,
    });
    const programConfigPda = multisig.getProgramConfigPda({})[0];
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(connection,programConfigPda);
    const configTreasury = programConfig.treasury;
    const compute = ComputeBudgetProgram.setComputeUnitPrice({microLamports:100000000});
    const limit = ComputeBudgetProgram.setComputeUnitLimit({units:800000})
    const transaction = new Transaction({
      feePayer: fromPubkey,
      blockhash,
      lastValidBlockHeight
    }).add(
      compute,
      limit,
      multisig.instructions.multisigCreateV2({
        treasury: configTreasury,
        creator: fromPubkey,
        multisigPda: multisigPda,
        configAuthority: null,
        threshold: 1,
        members: [{
            // Members Public Key
            key: fromPubkey,
            // Members permissions inside the multisig
            permissions: Permissions.all(),
        }
        ],
        timeLock: 0,
        createKey: createKey.publicKey,
        rentCollector: null,
      })
    );
    transaction.partialSign(createKey);
    const payload = await createPostResponse({
      fields: {
        transaction,
        message: `Created Squad at ${multisigPda}!`,
      },
    });
    res.json(payload);  
  } catch (err) {
    res.status(400).json({ error: err.message || "An unknown error occurred" });
  }
}

async function postCreateSquadGroup(req:any, res:any) {
      try {
        const { data, threshold } = (req.query);
        const { account } = req.body;
        const userKeys = await processUserKeys(data);
        userKeys.push(account);
        const len = userKeys.length;
        let thresh = 0;
        if(parseInt(threshold)===25){
          thresh = Math.floor(len*0.25);
        }
        else if(parseInt(threshold)===50){
          thresh = Math.floor(len*0.5);
        }
        else if(parseInt(threshold)===75){
          thresh = Math.floor(len*0.75);
        }
        if (!account) {
          throw new Error('Invalid "account" provided');
        }
        const fromPubkey = new PublicKey(account);
        const minimumBalance = await connection.getMinimumBalanceForRentExemption(0);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
        const createKey = Keypair.generate();
        // Derive the multisig account PDA
        const [multisigPda] = multisig.getMultisigPda({
              createKey: createKey.publicKey,
        });
        const programConfigPda = multisig.getProgramConfigPda({})[0];
        const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(connection,programConfigPda);
        const configTreasury = programConfig.treasury;
        const compute = ComputeBudgetProgram.setComputeUnitPrice({microLamports:100000000});
        const limit = ComputeBudgetProgram.setComputeUnitLimit({units:800000});
        const transaction = new Transaction({
          feePayer: fromPubkey,
          blockhash,
          lastValidBlockHeight
        }).add(
          compute,
          limit,
          multisig.instructions.multisigCreateV2({
            treasury: configTreasury,
            creator: fromPubkey,
            multisigPda: multisigPda,
            configAuthority: null,
            threshold: thresh,
            members: userKeys.map(item => ({ key: new PublicKey(item), permissions: Permissions.all()})),
            timeLock: 0,
            createKey: createKey.publicKey,
            rentCollector: null,
          })
        );
        transaction.partialSign(createKey);
        const payload = await createPostResponse({
          fields: {
            transaction,
            message: `Created Squad at ${multisigPda}!`,
          },
        });
        res.json(payload);
      } catch (err:any) {
        res.status(400).json({ error: err.message || "An unknown error occurred" });
      }
  }

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
