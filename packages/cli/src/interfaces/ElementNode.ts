import type { BindingInfo } from './BindingInfo.js';
import type { TemplateNode } from './TemplateNode.js';
import type { Parse5NS } from '../Parse5Helpers.js';

export interface ElementNode
{
    type: 'element';
    tagName: string;
    attributes: Record<string, string>;
    bindings: BindingInfo[];
    children: TemplateNode[];
    id?: string;
    namespaceURI?: Parse5NS;
}
