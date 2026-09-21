/**
 * The UseCase and FlowUseCase base classes from the Kotlin project, as types.
 *
 * Kotlin needs an abstract class because it has no first-class functions with
 * named parameters. TypeScript does, so these are structural types rather than
 * a class hierarchy: anything with the right shape is a use case, and there is
 * no `extends` to forget.
 *
 * The naming convention is kept deliberately. `ObservePortfolioUseCase` in
 * Kotlin is `ObservePortfolio` typed as `FlowUseCase<...>` here, so the two
 * codebases read the same way.
 */

/** A one-shot operation: fetch, save, delete. */
export type UseCase<Input, Output> = (input: Input) => Promise<Output>;

/** A stream: prices, portfolio, feed status. */
export type FlowUseCase<Input, Output> = (input: Input) => AsyncIterable<Output>;

/**
 * Wraps a function so it is named in stack traces and cannot be called with
 * the wrong arity. Cheap, and it makes the DI wiring read like the Kotlin one.
 */
export function useCase<Input, Output>(
  name: string,
  fn: (input: Input) => Promise<Output>,
): UseCase<Input, Output> {
  const wrapped = (input: Input) => fn(input);
  Object.defineProperty(wrapped, 'name', { value: name });
  return wrapped;
}

export function flowUseCase<Input, Output>(
  name: string,
  fn: (input: Input) => AsyncIterable<Output>,
): FlowUseCase<Input, Output> {
  const wrapped = (input: Input) => fn(input);
  Object.defineProperty(wrapped, 'name', { value: name });
  return wrapped;
}
