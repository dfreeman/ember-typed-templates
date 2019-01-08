'use strict';

const path = require('path');
const fs = require('fs-extra');
const Filter = require('broccoli-persistent-filter');
const Writer = require('broccoli-caching-writer');
const Funnel = require('broccoli-funnel');
const { stripIndent } = require('common-tags');
const inflector = require('inflected');
const { determineName, determineType } = require('./lib/utils/hacky-path-analysis');

module.exports = {
  name: 'ember-typed-templates',

  setupDeclarationGeneratorRegistry(type, registry) {
    if (type !== 'parent') return;

    registry.addGenerator({
      name: 'type-registry-generator',
      toTree: (type, tree) => new RegistryWriter(tree, { project: this.project, type })
    });

    registry.addGenerator({
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
    if (this.type !== 'js' && this.type !== 'src') return;

    let modulePrefix = this.modulePrefix();
    let registries = {
      component: { name: 'ComponentRegistry', items: [] },
      template: { name: 'TemplateRegistry', items: [] },
      controller: { name: 'ControllerRegistry', items: [] },
      helper: { name: 'HelperRegistry', items: [] }
    };

    for (let absoluteFile of this.listFiles()) {
      let file = absoluteFile.substring(this.inputPaths[0].length + 1 + modulePrefix.length + 1);
      let type = determineType(file);
      if (type) {
        let name = determineName(file);
        let dashedName = `${name.replace(/\//g, '-')}-${type}`;
        let importName = inflector.classify(inflector.underscore(dashedName));
        registries[type].items.push({ file, name, importName });
      }
    }

    let output = Object.keys(registries).map(key => this.buildRegistryString(registries[key]));
    let registryFile = `${this.outputPath}/${modulePrefix}/type-registries.d.ts`;

    fs.ensureDirSync(path.dirname(registryFile));
    fs.writeFileSync(registryFile, output.join('\n\n'));
  }

  modulePrefix() {
    if (this.type === 'js' && this.project.isEmberCLIAddon()) {
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
    const DeclarationBuilder = require('./lib/declaration-builder');

    let builder = new DeclarationBuilder(this.modulePrefix(), relativePath);
    builder.process(content);
    return builder.serialize();
  }

  modulePrefix() {
    if (this.type === 'js' && this.project.isEmberCLIAddon()) {
      return 'dummy';
    } else {
      return this.project.name();
    }
  }
}
