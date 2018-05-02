import TestComponentComponent from 'dummy/components/test-component/component';

export interface ComponentRegistry {
  'test-component': TestComponentComponent;
}

import TestComponentTemplate from 'dummy/components/test-component/template';
import ApplicationTemplate from 'dummy/templates/application';

export interface TemplateRegistry {
  'test-component': TestComponentTemplate;
  'application': ApplicationTemplate;
}

export interface ControllerRegistry {
  
}

export interface HelperRegistry {
  
}