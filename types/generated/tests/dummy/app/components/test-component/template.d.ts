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
}

type template = TemplateFactory;
declare const template: template;
export default template;
