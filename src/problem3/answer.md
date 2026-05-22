# Problem 3

## Computational inefficiencies and anti-patterns

1. `WalletBalance` is missing fields that are used later.
   The code reads `balance.blockchain`, but the `WalletBalance` interface only declares `currency` and `amount`. This defeats TypeScript's safety and should be modeled explicitly.

2. `getPriority` accepts `any`.
   Using `any` removes useful type checking. The blockchain value should be typed as a string union or at least `string`.

3. `getPriority` is recreated on every render.
   It is a pure lookup and does not need to be redeclared each render. A constant map outside the component is simpler and cheaper.

4. `useMemo` has an incorrect dependency list.
   `sortedBalances` depends on `balances` only, but `prices` is included. Any price update unnecessarily recomputes filtering and sorting.

5. The filter condition has a variable typo.
   `lhsPriority` is referenced inside the filter, but it is not defined. The intended variable appears to be `balancePriority`.

6. The amount filter logic is inverted.
   The code returns `true` when `balance.amount <= 0`, so it keeps empty or negative balances and removes positive balances. Usually a wallet should display balances with `amount > 0`.

7. The filter performs nested branching where a single boolean expression is clearer.
   The filter can be written as `getPriority(balance.blockchain) > -99 && balance.amount > 0`.

8. Sorting comparator can return `undefined`.
   `Array.prototype.sort` expects a number. When priorities are equal, the comparator returns nothing. It should return `rightPriority - leftPriority` or explicitly return `0`.

9. `sort` mutates the array it is called on.
   In this code it sorts the new array returned by `filter`, so it does not mutate `balances`. That is safe here, but it is still worth being deliberate when sorting hook data. If `filter` were removed later, this could accidentally mutate data from `useWalletBalances`.

10. Priority is recalculated multiple times.
    `getPriority` is called during filtering and again during sorting, often repeatedly for the same balance. For large lists, compute priority once before filtering/sorting.

11. `formattedBalances` is computed but not used.
    The code creates `formattedBalances`, then maps `sortedBalances` instead. This is wasted work and also causes a type mismatch because `sortedBalances` items do not have `formatted`.

12. Rows are recomputed on every render.
    Mapping rows is usually cheap, but if the list is large or `WalletRow` is expensive, memoizing formatted row data can reduce unnecessary work.

13. Array index is used as a React key.
    `key={index}` can cause incorrect component reuse when rows are reordered, inserted, or removed. A stable key such as `blockchain-currency` is safer.

14. `React.FC` is not necessary.
    `React.FC<Props>` is often avoided because it implicitly adds `children` and can make component typing less explicit. A normal typed function component is simpler.

15. `children` is destructured but never rendered.
    `const { children, ...rest } = props` removes `children` from `rest`, but the returned JSX does not render `{children}`. Either render it or do not accept/destructure it.

16. Empty interface body.
    `interface Props extends BoxProps {}` adds no new shape. A type alias such as `type Props = BoxProps` is clearer unless the interface will be extended.

17. Formatting omits decimals.
    `balance.amount.toFixed()` defaults to zero decimal places. Token balances often need meaningful precision, for example `toFixed(2)` or a locale formatter.

18. Missing fallback for unknown prices.
    `prices[balance.currency] * balance.amount` returns `NaN` if the price is missing. Use `prices[balance.currency] ?? 0`.

19. Missing semicolons and inconsistent style.
    This is not a runtime issue, but consistent formatting reduces review noise and makes errors easier to spot.

## Refactored Version

```tsx
type Blockchain = "Osmosis" | "Ethereum" | "Arbitrum" | "Zilliqa" | "Neo";

interface WalletBalance {
  currency: string;
  amount: number;
  blockchain: Blockchain | string;
}

interface FormattedWalletBalance extends WalletBalance {
  formatted: string;
  priority: number;
  usdValue: number;
}

type Props = BoxProps;

const BLOCKCHAIN_PRIORITY: Record<Blockchain, number> = {
  Osmosis: 100,
  Ethereum: 50,
  Arbitrum: 30,
  Zilliqa: 20,
  Neo: 20,
};

function getPriority(blockchain: WalletBalance["blockchain"]): number {
  return BLOCKCHAIN_PRIORITY[blockchain as Blockchain] ?? -99;
}

function WalletPage(props: Props) {
  const balances = useWalletBalances();
  const prices = usePrices();

  const rows = useMemo<FormattedWalletBalance[]>(() => {
    return balances
      .map((balance: WalletBalance) => ({
        ...balance,
        priority: getPriority(balance.blockchain),
      }))
      .filter((balance) => balance.priority > -99 && balance.amount > 0)
      .sort((left, right) => right.priority - left.priority)
      .map((balance) => ({
        ...balance,
        formatted: balance.amount.toFixed(2),
        usdValue: (prices[balance.currency] ?? 0) * balance.amount,
      }));
  }, [balances, prices]);

  return (
    <div {...props}>
      {rows.map((balance) => (
        <WalletRow
          className={classes.row}
          key={`${balance.blockchain}-${balance.currency}`}
          amount={balance.amount}
          usdValue={balance.usdValue}
          formattedAmount={balance.formatted}
        />
      ))}
    </div>
  );
}
```

This version keeps the same rendering behavior, but fixes the type errors, removes the unused work, avoids unstable keys, handles missing prices, and computes each balance priority only once.
