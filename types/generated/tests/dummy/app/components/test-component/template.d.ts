import { ControllerRegistry, ComponentRegistry, HelperRegistry } from 'dummy/type-registries';
import { findHost, resolve } from 'ember-typed-templates';
import { assert, exists } from 'ember-typed-templates/assertions';

type host = findHost<'test-component', ControllerRegistry, ComponentRegistry>;
type root = {
  locals: {};
  components: ComponentRegistry;
  helpers: HelperRegistry;
  host: host;
};

type greeting = resolve<root, 'greeting', 'locals' | 'helpers' | 'host'>;
type target = resolve<root, 'target', 'locals' | 'helpers' | 'host'>;

type assertions = never
  & assert<
    "Unable to resolve {{greeting}}", { line: 1, column: 0 },
    exists<greeting>
  >
  & assert<
    "Unable to resolve {{target}}", { line: 1, column: 14 },
    exists<target>
  >;


import { TemplateFactory } from 'htmlbars-inline-precompile';
type template = TemplateFactory;
declare const template: TemplateFactory;
export default template;
