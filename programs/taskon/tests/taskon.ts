import * as anchor from "@project-serum/anchor";
import * as splToken from "@solana/spl-token";
import { Program } from "@project-serum/anchor";
import { Taskon } from "../target/types/Taskon";
import { LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";


describe("taskon", () => {

  const provider =  anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Taskon as Program<Taskon>;

  const projectParty =  provider.wallet.publicKey; // anchor.web3.Keypair.generate();
  const payer = (provider.wallet as NodeWallet).payer;
  const  admin =  (provider.wallet as NodeWallet).payer;

  const user =  anchor.web3.Keypair.generate();
  console.log(`user :: `, user.publicKey.toString());

  const escrowedXTokens = anchor.web3.Keypair.generate();
  console.log(`escrowedXTokens :: `, escrowedXTokens.publicKey.toString());


  let x_mint;
  let project_x_token;
  let user_x_token;
  let escrow: anchor.web3.PublicKey;

  before(async() => {
    await provider.connection.requestAirdrop(payer.publicKey, 1*LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 1*LAMPORTS_PER_SOL);

    // Derive escrow address
    [escrow] = await anchor.web3.PublicKey.findProgramAddress([
          anchor.utils.bytes.utf8.encode("taskon"),
          projectParty.toBuffer()
        ], program.programId)

    x_mint = await splToken.Token.createMint(
        provider.connection,
        payer,
        provider.wallet.publicKey,
        provider.wallet.publicKey,
        6,
        splToken.TOKEN_PROGRAM_ID
    );

    console.log(`x_mint :: `, x_mint.publicKey.toString());

    // seller's x and y token account
    project_x_token = await x_mint.createAccount(projectParty);
    console.log(`project_x_token :: `, project_x_token.toString());

    await x_mint.mintTo(project_x_token, payer, [], 10_000_000_000);

    user_x_token = await x_mint.createAccount(user.publicKey);
    console.log(`user_x_token :: `, user_x_token.toString());
  })


  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize(admin.publicKey.toBytes())
        .accounts({
          deployer: payer.publicKey,
          admin: admin.publicKey,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId
        }).rpc();
    console.log("Your transaction signature", tx);
  });
});
