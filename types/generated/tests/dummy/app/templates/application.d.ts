import { ControllerRegistry, ComponentRegistry, HelperRegistry } from 'dummy/type-registries';
import { findHost, resolve } from 'ember-typed-templates';
import { assert, exists } from 'ember-typed-templates/assertions';

type host = findHost<'application', ControllerRegistry, ComponentRegistry>;
type root = {
  locals: {};
  components: ComponentRegistry;
  helpers: HelperRegistry;
  host: host;
};



type assertions = never
  ;


import { TemplateFactory } from 'htmlbars-inline-precompile';
type template = TemplateFactory;
declare const template: TemplateFactory;
export default template;
