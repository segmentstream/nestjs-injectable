# nestjs-injectable

NestJS `@Injectable` on steroids for pure IoC

![npm version](https://badgen.net/npm/v/nestjs-injectable)
[![Test Coverage](https://api.codeclimate.com/v1/badges/9e213fad40ff3497a834/test_coverage)](https://codeclimate.com/repos/60f173630491380161009882/test_coverage)

## Tl;dr

```ts
import { Module, Inject } from '@nestjs/common';

// create interface (and token) for low-level dependency
// in your high-level module right in the same place
// when you are going using it
export const fooToken = Symbol()
export interface IFoo {
  // ...
}

class Bar {
  // depend on abstraction, not the implementation
  constructor(@Inject(fooToken) private foo: IFoo) {}
}

@Module({
  // no need to import module with IFoo implementation:
  // dependency inversion principle in action
  imports: [],
  providers: [Bar],
  exports: [Bar],
})
export class BarModule {}
```

```ts
// 
//      replace Injectable from '@nestjs/common'
//      with Injectable from 'nestjs-injectable'
//
import { Injectable } from 'nestjs-injectable';
import { Global, Module } from '@nestjs/common';

// inside your low-level module import both
// interface and token from high-level module
import { IFoo, fooToken } from '../bar'

// pass token to @Injectable().As(...) decorator
@Injectable().As(fooToken)
class FooImpl implements IFoo {
  // 
  static providers = [];

  // ... implementation goes here ...
}

@Global()
@Module({
  // pass FooImpl.providers as providers to module...
  providers: FooImpl.providers,
  // ... and don't forget to export
  exports: FooImpl.providers,
})
export class BarModule {}
```

That's it. Now your high-level class is not depend on low-level class. But there is no need to deel with custom providers.

## Pros

- no need to set up custom providers, and check if everything is synchronized
- when implementing some interface there is a single file which has a deal with tokens and interfaces
- when need to implement one new interface just import token and interface and add it to proper place in existing class

## Install

```sh
npm i nestjs-injectable
```


## Deep dive into problem with implementing DIP in NestJS

NestJS with it's built-in DI forces usage of [traditional layers pattern](https://en.wikipedia.org/wiki/Dependency_inversion_principle#Traditional_layers_pattern) with it's simplicity:

```ts
import { Injectable, Module } from '@nestjs/common';
import { BarImpl, BarModule } from '../modules/bar'

@Injectable()
export class Foo {
  constructor(private bar: BarImpl) {}

  foo() {
    return this.bar.bar()
  }
}

@Module({
  imports: [BarModule],
  providers: [Foo],
  exports: [Foo]
})
export class FooModule {}
```

That works well for not big CRUD-like applications. But when the system grows it becomes harder to maintain and test it because high-level modules with business logic depends directly on implementation of low-level modules. So here [dependency inversion principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle#Dependency_inversion_pattern) can solve this problem. NestJS allows usage of this principle like so:

```ts
import { Inject, Module, Global } from '@nestjs/common';
import { IFoo, fooToken } from '../modules/baz'

export const barToken = Symbol()
export interface IBar {
  bar();
}

export class Foo implements IFoo {
  constructor(@Inject(barToken) private bar: IBar) {}

  foo() {
    return this.bar.bar()
  }
}

// as we don't want `Baz` to depend on module which
// exports `IFoo` implementation, this module should
// be global
@Global()
@Module({
  // we deleted import of `Bar` module here
  // it should work same way as current module:
  // be global and export provider for `barToken`
  providers: [{ provide: fooToken, useClass: Foo }],
  exports: [fooToken]
})
export class FooModule {}
```

Now imagine you have for example DAO service for database that implements a lot of interfaces for different usecases:

```ts
@Injectable()
export class FooRepository implements
  FooCreator,
  FooGetterByID,
  FooGetterByFilters,
  FooGetterAll,
  FooUpdater,
  FooUpdaterWithAccessCheck,
  FooDeleter,
  FooDeleterWithAccessCheck
  // ...,
  {
    // here goes implementation
}
```

Then in your `Foo` module there should be provider for each of these interfaces:

```ts
// foo.providers.ts

export const providers = [
  // provide repository and use it as existing provider
  // for different tokens
  FooRepository,
  {
    provide: fooCreatorToken,
    useExisting: FooRepository
  },
  {
    provide: fooGetterByIDToken,
    useExisting: FooRepository
  },
  {
    provide: fooGetterByFiltersToken,
    useExisting: FooRepository
  },
  {
    provide: fooGetterAllToken,
    useExisting: FooRepository
  },
  {
    provide: fooUpdaterToken,
    useExisting: FooRepository
  },
  {
    provide: fooUpdaterWithAccessCheckToken,
    useExisting: FooRepository
  },
  {
    provide: fooDeleterToken,
    useExisting: FooRepository
  },
  {
    provide: fooDeleterWithAccessCheckToken,
    useExisting: FooRepository
  },
]

// foo.module.ts

import { providers } from './foo.providers.ts'

@Global()
@Module({
  providers: providers,
  exports: providers,
})
export class FooModule {}
```

And from our experience it's hard to keep it synchronized, because when you introduce new interface for new usecase after implementation you can forget to add new provider, because all this logic is located between several files.

## Solution

That would be much better if we could register our implementation as a provider for concrete interfaces by concrete tokens just near implementation class.

<center>🚀🚀🚀 And you can do it with this library 🚀🚀🚀</center>

At first replace the `Injectable` with the new one from this library:

```diff
-- import { Injectable } from '@nestjs/common';
++ import { Injectable } from 'nestjs-injectable';
```

Now it should work the same way without any changed behaviour. Next step is to register your tokens:

```diff
-- import { FooCreator } from '../modules/bar'
++ import { FooCreator, fooCreatorToken } from '../modules/bar'
-- import { FooGetterByID } from '../modules/baz'
++ import { FooGetterByID, fooGetterByIDToken } from '../modules/baz'
// and so on

-- @Injectable()
++ @Injectable().As(
++   fooCreatorToken,
++   fooGetterByIDToken,
++   fooGetterByFiltersToken,
++   fooGetterAllToken,
++   fooUpdaterToken,
++   fooUpdaterWithAccessCheckToken,
++   fooDeleterToken,
++   fooDeleterWithAccessCheckToken,
++ )
export class FooRepository implements
  FooCreator,
  FooGetterByID,
  FooGetterByFilters,
  FooGetterAll,
  FooUpdater,
  FooUpdaterWithAccessCheck,
  FooDeleter,
  FooDeleterWithAccessCheck
  // ...,
  {
++    // class with @Injectable().As() decorator
++    // should have static field providers.
++    // we will see how it's used on the next step
++    static providers: Provider[] = [];

    // here goes implementation
}
```

Now you can see that it's more easy to check that when you import some interface for implementation you shoud also import it's token and register it in `@Injectable().As(...)` function. And that's the single place when you need it to be imported.

And the last step is to simplify providers:

```diff
++ // Now you can simply remove providers, you don't need it
-- // foo.providers.ts
-- 
-- export const providers = [
--   // provide repository and use it as existing provider
--   // for different tokens
--   FooRepository,
--   {
--     provide: fooCreatorToken,
--     useExisting: FooRepository
--   },
--   {
--     provide: fooGetterByIDToken,
--     useExisting: FooRepository
--   },
--   {
--     provide: fooGetterByFiltersToken,
--     useExisting: FooRepository
--   },
--   {
--     provide: fooGetterAllToken,
--     useExisting: FooRepository
--   },
--   {
--     provide: fooUpdaterToken,
--     useExisting: FooRepository
--   },
--   {
--     provide: fooUpdaterWithAccessCheckToken,
--     useExisting: FooRepository
--   },
--   {
--     provide: fooDeleterToken,
--     useExisting: FooRepository
--   },
--   {
--     provide: fooDeleterWithAccessCheckToken,
--     useExisting: FooRepository
--   },
-- ]

// foo.module.ts

-- import { providers } from './foo.providers.ts'
++ import { FooRepository } from './foo.repository.ts'

@Global()
@Module({
--  providers: providers,
--  exports: providers,
++  providers: FooRepository.providers,
++  exports: FooRepository.providers,
})
export class FooModule {}
```

That's it. Now it works the same as before, but code is much more maintainable

## FAQ

#### 1. Why do I need to add `static providers: Provider[] = []` (or more short `static providers = []`)? Can this be done under the hood?

Yes, on runtime it's overwritten with proper value. But when you are trying to access to `MyService.providers` in `@Module({ providers: MyService.providers })` typescript will show error that there is no such field on `MyService`. That's why `@Injectable().As()` show error at first place when you forget to add such static field on your class.

Of course, that would be more convenient if decorator could extend signatur if decorated object, but right now that's not available in typescript: [#40805](https://github.com/microsoft/TypeScript/issues/40805), [#4881](https://github.com/microsoft/TypeScript/issues/4881).

In future when this will be allowed, we will drop that requirement.
