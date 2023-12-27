use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak::hashv as keccak;
use anchor_lang::solana_program::secp256k1_recover::secp256k1_recover;
use anchor_spl::token::{Mint, Token, TokenAccount};


declare_id!("BBpT4XAm4XzvfyhXbxhREudv3Za1zMyYw7roXHdd9qT9");

//需求
//项目方把token存进来
//用户完成任务后，拿到后台服务管理员的签名，调用合约领取token

//实现设计
//1. init 方法，将后台服务器的公钥保存到链上（如果不存在链上的话，就每次用户withdraw的时候传给合约）
//2. deposit方法，项目方调用deposit方法把token存到合约account
//3. withdraw方法，用户调用withdraw方法领取 token

#[program]
pub mod taskon {
    use super::*;

    const ESCROW_PDA_SEED: &[u8] = b"taskon";


    //将管理员私钥保存到链上
    pub fn initialize(ctx: Context<Initialize>, nonce: u64) -> Result<()> {
        let admin = &mut ctx.accounts.taskon_signer;
        admin.taskon_signer = ctx.accounts.user.key().clone();
        admin.nonce = nonce;
        Ok(())
    }

    pub fn deposit(ctx: Context<DepositToken>, x_amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        let (pda, _bump_seed) = Pubkey::find_program_address(&[ESCROW_PDA_SEED], ctx.program_id);
        escrow.authority = pda;
        escrow.escrowed_x_tokens = ctx.accounts.escrowed_x_tokens.key();

        // let (pda, _bump_seed) = Pubkey::find_program_address(&[ESCROW_PDA_SEED], ctx.program_id);

        // Transfer seller's x_token in program owned escrow token account
        anchor_spl::token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.business_x_token.to_account_info(),
                    to: ctx.accounts.escrowed_x_tokens.to_account_info(),
                    authority: ctx.accounts.business.to_account_info(),
                },
            ),
            x_amount,
        )?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64, nonce: u64, signer: [u8; 32], signature: [u8; 64], recovery_id: u8) -> Result<()> {
        //用户token地址,数量和nonce值计算hash,校验签名
        let msg_hash = keccak(&[ctx.accounts.user_x_token.owner.as_ref(), amount.to_le_bytes().as_ref(),
            nonce.to_le_bytes().as_ref()]);
        let pk = secp256k1_recover(msg_hash.as_ref(), recovery_id, signature.as_ref())
            .map_err(|_e| TaskonError::InvalidSigner)?;
        //校验管理员签名
        require!(keccak(&[pk.0.as_ref()]).0 == signer, TaskonError::InvalidSigner);

        let (_pda, bump_seed) = Pubkey::find_program_address(&[ESCROW_PDA_SEED], ctx.program_id);
        let seeds = &[&ESCROW_PDA_SEED[..], &[bump_seed]];


        //给用户打token
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.escrowed_x_tokens.to_account_info(),
                    to: ctx.accounts.user_x_token.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[&seeds[..]],
            ),
            amount,
        )?;
        Ok(())
    }
}

#[error_code]
pub enum TaskonError {
    #[msg("Authority error")]
    Forbidden,
    #[msg("Invalid signer error")]
    InvalidSigner,
}

// taskon 管理员初始化合约， 会保存服务器的singer publicKey到链上
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = AdminSigner::LEN)]
    pub taskon_signer: Account<'info, AdminSigner>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositToken<'info> {
    /// 项目方
    #[account(mut)]
    pub business: Signer<'info>,
    /// Token x mint for ex. USDC
    pub x_mint: Account<'info, Mint>,

    /// ATA of x_mint
    #[account(mut, constraint = business_x_token.mint == x_mint.key() && business_x_token.owner == business.key())]
    pub business_x_token: Account<'info, TokenAccount>,

    #[account(init, payer = business, space = Escrow::LEN)]
    pub escrow: Account<'info, Escrow>,

    #[account(
    init,
    payer = business,
    token::mint = x_mint,
    token::authority = escrow,
    )]
    pub escrowed_x_tokens: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}


#[account]
pub struct Escrow {
    pub authority: Pubkey,
    pub escrowed_x_tokens: Pubkey,
}

impl Escrow {
    pub const LEN: usize = 8 + 32 + 32;
}

//用来存储 后台签名管理员的公钥
#[account]
pub struct AdminSigner {
    pub nonce: u64,
    pub taskon_signer: Pubkey,
}

impl AdminSigner {
    pub const LEN: usize = 8 + 8 + 32;
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub user: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    #[account(mut, constraint = escrowed_x_tokens.key() == escrow.escrowed_x_tokens)]
    pub escrowed_x_tokens: Account<'info, TokenAccount>,

    #[account(mut, constraint = user_x_token.owner == user.key())]
    pub user_x_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
