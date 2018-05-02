'use strict';

const fs = require('fs-extra');
const Filter = require('broccoli-persistent-filter');
const Writer = require('broccoli-caching-writer');
const Funnel = require('broccoli-funnel');
const syntax = require('@glimmer/syntax');
const { stripIndent } = require('common-tags');
const inflector = require('inflected');

module.exports = {
  name: 'ember-typed-templates',

  setupTypeGeneratorRegistry(type, registry) {
    if (type !== 'parent') return;

    let generators = registry._generators;
    let existing = generators.find(gen => gen.name === 'template-type-generator');
    generators.splice(generators.indexOf(existing), 1);

    registry.add({
      name: 'type-registry-generator',
      toTree: (type, tree) => new RegistryWriter(tree, { project: this.project, type })
    });

    registry.add({
      name: 'template-type-generator',
      toTree: (type, tree) => {
        let types = new TemplateTypeGenerator(tree, { project: this.project, type });
        return new Funnel(types, { include: ['**/*.d.ts'] });
      }
    });
  }
};

class RegistryWriter extends Writer {
  constructor(tree, options) {
    super([tree]);
    this.project = options.project;
    this.type = options.type;
  }

  build() {
    if (this.type !== 'app' && this.type !== 'addon') return;

    let registries = {
      component: { name: 'ComponentRegistry', items: [] },
      template: { name: 'TemplateRegistry', items: [] },
      controller: { name: 'ControllerRegistry', items: [] },
      helper: { name: 'HelperRegistry', items: [] }
    };

    for (let absoluteFile of this.listFiles()) {
      let file = absoluteFile.substring(this.inputPaths[0].length + 1);
      let type = determineType(file);
      if (type) {
        let name = determineName(file);
        let dashedName = `${name.replace(/\//g, '-')}-${type}`;
        let importName = inflector.classify(inflector.underscore(dashedName));
        registries[type].items.push({ file, name, importName });
      }
    }

    let output = Object.keys(registries).map(key => this.buildRegistryString(registries[key]));
    fs.writeFileSync(`${this.outputPath}/type-registries.d.ts`, output.join('\n\n'));
  }

  modulePrefix() {
    if (this.type === 'app' && this.project.isEmberCLIAddon()) {
      return 'dummy';
    } else {
      return this.project.name();
    }
  }

  buildRegistryString({ name, items }) {
    let modulePrefix = this.modulePrefix();
    let imports = [];
    let entries = [];
    for (let item of items) {
      let importPath = item.file.replace(/\.\w+$/, '');
      imports.push(`import ${item.importName} from '${modulePrefix}/${importPath}';`);
      entries.push(`'${item.name}': ${item.importName};`);
    }

    return stripIndent`
      ${imports.join('\n      ')}

      export interface ${name} {
        ${entries.join('\n        ')}
      }
    `;
  }
}

class TemplateTypeGenerator extends Filter {
  constructor(tree, options) {
    super(tree, {
      extensions: ['hbs'],
      targetExtension: ['d.ts']
    });

    this.project = options.project;
    this.type = options.type;
  }

  processString(content, relativePath) {
    let name = determineName(relativePath);
    let builder = new DeclarationBuilder(this.project, this.type, name);
    syntax.traverse(syntax.preprocess(content), builder.makeVisitor());
    return builder.serialize();
  }
}

function determineType(relativePath) {
  if (!/\.(hbs|ts)/.test(relativePath)) return;

  let podName = /\/(template|component|controller|helper)\.(?:hbs|ts)$/.exec(relativePath);
  if (podName) {
    return podName[1];
  }

  let grouping = /(?:^|\/)(template|component|controller|helper)s\//.exec(relativePath);
  if (grouping) {
    return grouping[1];
  }
}

function determineName(relativePath) {
  return relativePath
    .replace(/(^|\/)(templates|components|controllers|helpers)\//g, '')
    .replace(/\.(hbs|ts)$/, '')
    .replace(/\/(template|component|controller|helper)$/, '');
}

class DeclarationBuilder {
  constructor(project, type, name) {
    this.project = project;
    this.type = type;
    this.name = name;

    let root = new Scope('root', {
      locals: '{}',
      components: 'ComponentRegistry',
      helpers: 'HelperRegistry',
      host: 'host'
    });

    this.types = [];
    this.scopes = [root];
    this.stack = [root];
    this.assertions = [];
  }

  makeVisitor() {
    let visitor = {};
    for (let type of ['MustacheStatement']) {
      visitor[type] = node => this[`visit${type}`](node);
    }
    return visitor;
  }

  serialize() {
    return stripIndent`
      import { ControllerRegistry, ComponentRegistry, HelperRegistry } from '${this.modulePrefix()}/type-registries';
      import { findHost, resolve } from 'ember-typed-templates';
      import { assert, exists } from 'ember-typed-templates/assertions';

      type host = findHost<'${this.name}', ControllerRegistry, ComponentRegistry>;
      ${this.scopes.map(scope => scope.serialize('      ')).join('\n\n      ')}

      ${this.types.map(({ name, type }) => `type ${name} = ${type.serialize('      ')};`).join('\n      ')}

      type assertions = never
        ${this.assertions.map(assertion => `& ${assertion.serialize('        ')}`).join('\n        ')};


      import { TemplateFactory } from 'htmlbars-inline-precompile';
      type template = TemplateFactory;
      declare const template: TemplateFactory;
      export default template;
    ` + '\n';
  }

  visitMustacheStatement(node) {
    let path = node.path;
    if (path.parts.length === 1) {
      if (keywords.includes(path.original)) return;

      let hasArgs = node.hash.pairs.length || node.params.length;
      let hasDash = path.original.indexOf('-') !== -1;
      let candidates = [
        (hasDash || !hasArgs) && 'locals',
        (hasDash) && 'components',
        (true) && 'helpers',
        (!hasArgs) && 'host'
      ].filter(Boolean);

      let name = inflector.camelize(inflector.underscore(path.original), false);
      this.types.push({ name, type: this.resolve(path.original, candidates) });

      let resolved = new ReferenceType(name);
      let assertion = this.assert(`Unable to resolve {{${path.original}}}`, node.loc.start, this.exists(resolved));
      this.assertions.push(assertion);
    }
  }

  modulePrefix() {
    if (this.type === 'app' && this.project.isEmberCLIAddon()) {
      return 'dummy';
    } else {
      return this.project.name();
    }
  }

  assert(message, loc, assert) {
    return new AssertionType(message, loc, assert);
  }

  exists(info, type) {
    return new ExistenceAssertion(info, type);
  }

  resolve(name, types) {
    return new ResolutionType(this.stack[this.stack.length - 1], name, types);
  }
}

class Scope {
  constructor(name, parts) {
    this.name = name;
    this.parts = parts;
  }

  serialize(indent = '') {
    return [
      `type ${this.name} = {`,
      `  locals: ${this.parts.locals};`,
      `  components: ${this.parts.components};`,
      `  helpers: ${this.parts.helpers};`,
      `  host: ${this.parts.host};`,
      `};`
    ].join(`\n${indent}`);
  }
}

class ReferenceType {
  constructor(name) {
    this.name = name;
  }

  serialize() {
    return this.name;
  }
}

class ResolutionType {
  constructor(scope, name, types) {
    this.scope = scope;
    this.name = name;
    this.types = types;
  }

  serialize() {
    return `resolve<${this.scope.name}, '${this.name}', ${this.types.map(type => `'${type}'`).join(' | ')}>`;
  }
}

class AssertionType {
  constructor(message, loc, assertion) {
    this.message = message;
    this.loc = loc;
    this.assertion = assertion;
  }

  serialize(indent) {
    const { message, loc, assertion } = this;

    return [
      `assert<`,
      `  ${JSON.stringify(message)}, { line: ${loc.line}, column: ${loc.column} },`,
      `  ${assertion.serialize(`  ${indent}`)}`,
      `>`
    ].join(`\n${indent}`);
  }
}

class ExistenceAssertion {
  constructor(subject) {
    this.subject = subject;
  }

  serialize(indent) {
    return `exists<${this.subject.serialize('  ' + indent)}>`;
  }
}

const keywords = [
  'yield',
  'outlet',
];

/*

import { ControllerRegistry, ComponentRegistry, HelperRegistry } from '<host>/type-registries';
import { findHost, resolve } from 'ember-typed-templates';

type host = findHost<ControllerRegistry, ComponentRegistry, '<name>'>;
type root = {
  locals: {};
  components: ComponentRegistry;
  helpers: HelperRegistry;
  host: host;
};

type assertions =
  & resolve<root, 'accessedProperty', locals' | 'helpers' | 'host'>

*/


// {{#foo-bar}}
// local -> component

// {{foo-bar}}
// local -> component -> helper -> property

// {{foo-bar 'baz'}}
// local -> component -> helper

// {{foo}}
// local -> helper -> property

// {{foo 'bar'}}
// helper

// {{foo.bar 'baz'}}
// local
