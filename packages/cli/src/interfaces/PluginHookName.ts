export type PluginHookName =
    | 'afterConfig'
    | 'afterDiscovery'
    | 'beforeTemplatePreProcess'
    | 'afterTemplateParse'
    | 'afterCodeGeneration'
    | 'beforeClassTransform'
    | 'modifyEntryPoint'
    | 'modifyIndexHtml'
    | 'registerRuntimeImports'
    | 'registerCustomTables'
    | 'registerScopeElements';
