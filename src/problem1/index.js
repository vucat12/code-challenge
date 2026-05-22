/**
 * Implementation A: arithmetic-series formula.
 * Time: O(1), Space: O(1)
 */
function sum_to_n_a(n) {
  const sign = Math.sign(n);
  const limit = Math.abs(n);

  return sign * (limit * (limit + 1)) / 2;
}

/**
 * Implementation B: iterative loop.
 * Time: O(|n|), Space: O(1)
 */
function sum_to_n_b(n) {
  let sum = 0;
  const step = n < 0 ? -1 : 1;

  for (let value = step; Math.abs(value) <= Math.abs(n); value += step) {
    sum += value;
  }

  return sum;
}

/**
 * Implementation C: recursion.
 * Time: O(|n|), Space: O(|n|)
 */
function sum_to_n_c(n) {
  if (n === 0) {
    return 0;
  }

  return n + sum_to_n_c(n + (n < 0 ? 1 : -1));
}

module.exports = {
  sum_to_n_a,
  sum_to_n_b,
  sum_to_n_c,
};
