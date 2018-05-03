import { TemplateFactory } from 'htmlbars-inline-precompile';
import { ControllerRegistry, ComponentRegistry, HelperRegistry, TemplateRegistry } from 'dummy/type-registries';
import { findHost, resolve, makeScope, extendScope, blockParam } from 'ember-typed-templates';
import { Local, Component, Helper, Property } from 'ember-typed-templates';
import { assert, exists, hasBlockParam } from 'ember-typed-templates/assertions';

// The component or controller (if any) associated to this template
type host = findHost<"test-component", ComponentRegistry, ControllerRegistry>;

// The root scope of this template, including all globally available components and helpers
declare namespace root {
  type scope = makeScope<host, ComponentRegistry, TemplateRegistry, ControllerRegistry>;

  type refFooBar = resolve<scope, "foo-bar", Local | Component>;
  type refTestComponent = resolve<scope, "test-component", Local | Component>;

  type assertions =
    & assert<"Unable to resolve {{#foo-bar}}", [1, 0], exists<refFooBar>>
    & assert<"Unable to resolve block param 'value'", [1, 0], hasBlockParam<refFooBar, "0">>
    & assert<"Unable to resolve {{#test-component}}", [5, 0], exists<refTestComponent>>
    & assert<"Unable to resolve block param 'inner'", [5, 0], hasBlockParam<refTestComponent, "0">>;

  namespace fooBarBlock {
    type scope = extendScope<root.scope, {
      value: blockParam<root.refFooBar, "0">;
    }>;
  
    type refValue = resolve<scope, "value", Local | Property>;
  
    type assertions =
      & assert<"Unable to resolve 'value'", [2, 10], exists<refValue>>;
  }

  namespace testComponentBlock {
    type scope = extendScope<root.scope, {
      inner: blockParam<root.refTestComponent, "0">;
    }>;
  
    type refInner = resolve<scope, "inner", Local | Helper | Property>;
  
    type assertions =
      & assert<"Unable to resolve {{inner}}", [6, 2], exists<refInner>>;
  }
}

type template = TemplateFactory & {
  yields: [
    root.fooBarBlock.refValue
  ]
};

declare const template: template;
export default template;
