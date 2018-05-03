import FooBarComponent from 'dummy/components/foo-bar';
import TestComponentComponent from 'dummy/components/test-component/component';

export interface ComponentRegistry {
  'foo-bar': FooBarComponent;
  'test-component': TestComponentComponent;
}

import TestComponentTemplate from 'dummy/components/test-component/template';
import ApplicationTemplate from 'dummy/templates/application';
import FooBarTemplate from 'dummy/templates/components/foo-bar';

export interface TemplateRegistry {
  'test-component': TestComponentTemplate;
  'application': ApplicationTemplate;
  'foo-bar': FooBarTemplate;
}

export interface ControllerRegistry {
  
}

export interface HelperRegistry {
  
}