import {
  ExistingProvider,
  Injectable as LibInjectable,
  Provider,
  ScopeOptions,
  Type,
} from '@nestjs/common';

type Token = ExistingProvider['provide'];

type WithProviders<T> = T & { providers: Provider[] };

type As = (
  ...tokens: Token[]
) => <T extends Function>(target: WithProviders<T>) => any;

export function Injectable(
  options?: ScopeOptions | undefined,
): ClassDecorator & { As: As } {
  const injectableApplied = LibInjectable(options);

  return Object.assign(injectableApplied, {
    As(...tokens: Token[]) {
      return function <T extends Function>(target: WithProviders<T>): any {
        target.providers = [
          target as unknown as Type<any>,
          ...tokens.map(
            (token: Token): ExistingProvider => ({
              provide: token,
              useExisting: target,
            }),
          ),
        ];
        return injectableApplied(target);
      };
    },
  });
}
