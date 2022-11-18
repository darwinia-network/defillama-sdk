import { BigNumber } from "ethers";
import computeTVL from "./computeTVL";
import type { Balances, StringNumber, Address } from "./types";

// We ignore `sum` as it's never used (only in some SDK wrapper code)

export function sumMultiBalanceOf(
  balances: Balances,
  results: {
    ethCallCount?: number;
    output: {
      output: StringNumber;
      success: boolean;
      input: {
        target: Address;
        params: string[];
      };
    }[];
  },
  allCallsMustBeSuccessful = true,
  transformAddress = (addr:string)=>addr
) {
  results.output.map((result) => {
    if (result.success) {
      const address = transformAddress(result.input.target);
      const balance = result.output;

      if (BigNumber.from(balance).lte(0)) {
        return;
      }

      balances[address] = BigNumber.from(balances[address] ?? 0)
        .add(balance)
        .toString();
    } else if(allCallsMustBeSuccessful){
      console.error(result)
      throw new Error(`balanceOf multicall failed`)
    }
  });
}

export function sumSingleBalance(
  balances: Balances,
  token: string,
  balance: string | number,
  chain?: string,
) {
  if (chain)
    token = `${chain}:${token}`
  
  if (typeof balance === 'number') {
    const prevBalance = +(balances.hasOwnProperty(token) ? balances[token] : 0)
    if (typeof prevBalance !== 'number' || isNaN(prevBalance)) {
      throw new Error(`Trying to merge token balance and coingecko amount for ${token} current balance: ${balance} previous balance: ${balances[token]}`)
    }
    const value = prevBalance + balance
    isValidNumber(value)
    balances[token] = Number(value).toString()
  } else {
    const prevBalance = BigNumber.from(balances.hasOwnProperty(token) ? balances[token] : '0');
    const value = prevBalance.add(BigNumber.from(balance)).toString();
    isValidNumber(+value)
    balances[token] = value
  }

  function isValidNumber(value: number) {
    if (isNaN(value))
      throw new Error(`Invalid balance: ${balance}`)
  }
}

function mergeBalances(balances: Balances, balancesToMerge: Balances) {
  Object.entries(balancesToMerge).forEach((balance) => {
    sumSingleBalance(balances, balance[0], balance[1]);
  });
}
type ChainBlocks = {
  [chain: string]: number;
};
export function sumChainTvls(
  chainTvls: Array<
    (
      timestamp: number,
      ethBlock: number,
      chainBlocks: ChainBlocks
    ) => Promise<Balances>
  >
) {
  return async (
    timestamp: number,
    ethBlock: number,
    chainBlocks: ChainBlocks
  ) => {
    const balances = {};
    await Promise.all(
      chainTvls.map(async (chainTvl) => {
        const chainBalances = await chainTvl(timestamp, ethBlock, chainBlocks);
        mergeBalances(balances, chainBalances);
      })
    );
    return balances;
  };
}

export { computeTVL };
