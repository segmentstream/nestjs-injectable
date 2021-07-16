import { NestFactory } from '@nestjs/core';
import { Global, Inject, Module } from '@nestjs/common';
import { Injectable } from './injectable';

describe('', () => {
  it('should work', async () => {
    //
    // Service Bar

    const fooToken = Symbol();
    interface Foo {
      foo(): void;
    }

    @Injectable()
    class Bar {
      constructor(@Inject(fooToken) private foo: Foo) {}
      bar() {
        this.foo.foo();
      }
    }

    @Module({
      providers: [Bar],
      exports: [Bar],
    })
    class BarModule {}

    // Service Qux

    const bazToken = Symbol();
    interface Baz {
      baz(): void;
    }

    @Injectable()
    class Qux {
      constructor(@Inject(bazToken) private baz: Baz) {}
      qux() {
        this.baz.baz();
      }
    }

    @Module({
      providers: [Qux],
      exports: [Qux],
    })
    class QuxModule {}

    // Implementation

    @(Injectable().As(fooToken, bazToken))
    class FooBazImpl implements Foo, Baz {
      static providers = [];
      foo() {}
      baz() {}
    }

    @Global()
    @Module({
      providers: FooBazImpl.providers,
      exports: FooBazImpl.providers,
    })
    class FooBazModule {}

    @Module({
      imports: [BarModule, QuxModule, FooBazModule],
    })
    class TestModule {}

    const ctx = await NestFactory.createApplicationContext(TestModule);
    const fooBazImpl = ctx.get(FooBazImpl);

    const bar = ctx.get(Bar);
    const fooSpy = jest.spyOn(fooBazImpl, 'foo');
    bar.bar();
    expect(fooSpy).toBeCalled();

    const qux = ctx.get(Qux);
    const bazSpy = jest.spyOn(fooBazImpl, 'baz');
    qux.qux();
    expect(bazSpy).toBeCalled();
  });
});
