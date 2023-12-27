import * as anchor from "@coral-xyz/anchor";
import {Program} from "@coral-xyz/anchor";
import {Taskon} from "../target/types/taskon";
import * as splToken from "@solana/spl-token";
import {LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY} from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";


describe("taskon", () => {

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Taskon as Program<Taskon>;

    // const projectParty = provider.wallet.publicKey; // anchor.web3.Keypair.generate();
    const payer = (provider.wallet as NodeWallet).payer;

    const projectPartyKey = anchor.web3.Keypair.generate();
    const projectParty = projectPartyKey.publicKey;
    console.log(`projectParty :: `, projectParty.toString());

    const user = anchor.web3.Keypair.generate();
    console.log(`user :: `, user.publicKey.toString());

    const taskonAdmin = anchor.web3.Keypair.generate();
    console.log(`taskonAdmin :: `, taskonAdmin.publicKey.toString());

    const escrowedXTokens = anchor.web3.Keypair.generate();
    console.log(`escrowedXTokens :: `, escrowedXTokens.publicKey.toString());


    let x_mint;
    let project_x_token;
    let user_x_token;
    let escrow: anchor.web3.PublicKey;
    let escrow_x_token: anchor.web3.PublicKey;

    before(async () => {
        await provider.connection.requestAirdrop(taskonAdmin.publicKey, 1 * LAMPORTS_PER_SOL);
        await provider.connection.requestAirdrop(payer.publicKey, 1 * LAMPORTS_PER_SOL);
        await provider.connection.requestAirdrop(user.publicKey, 1 * LAMPORTS_PER_SOL);
        await provider.connection.requestAirdrop(projectPartyKey.publicKey, 1 * LAMPORTS_PER_SOL);

        // Derive escrow address
        [escrow,] = await anchor.web3.PublicKey.findProgramAddress([anchor.utils.bytes.utf8.encode("taskon")], program.programId)

        x_mint = await splToken.Token.createMint(
            provider.connection,
            payer,
            provider.wallet.publicKey,
            provider.wallet.publicKey,
            6,
            splToken.TOKEN_PROGRAM_ID
        );

        console.log(`x_mint :: `, x_mint.publicKey.toString());
        escrow_x_token = await x_mint.createAccount(escrow);
        console.log(`escrow_x_token :: `, escrow_x_token.toString());
        // seller's x and y token account
        project_x_token = await x_mint.createAccount(projectParty);
        console.log(`project_x_token :: `, project_x_token.toString());

        await x_mint.mintTo(project_x_token, payer, [], 10_000_000_000);

        user_x_token = await x_mint.createAccount(user.publicKey);
        console.log(`user_x_token :: `, user_x_token.toString());
    })

    it("Is initialized!", async () => {
        // Add your test here.
        const tx = await program.methods.initialize(new anchor.BN(0))
            .accounts({
                user: provider.wallet.publicKey,
                taskonSigner: taskonAdmin.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            }).signers([taskonAdmin]).rpc().catch((err) => {
                console.log("err:", err);
            });
        console.log("Your transaction signature", tx);
    });
    it("Deposit!", async () => {
        // Add your test here.
        const tx = await program.methods.deposit(new anchor.BN(1))
            .accounts({
                business: projectParty,
                xMint: x_mint.publicKey,
                businessXToken: project_x_token.publicKey,
                escrow: escrow,
                escrowedXTokens: escrow_x_token,
                tokenProgram: splToken.TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId
            }).signers([projectPartyKey]).rpc().catch((err) => {
                console.log("err:", err);
            });
        console.log("Your transaction signature", tx);
    });
});
