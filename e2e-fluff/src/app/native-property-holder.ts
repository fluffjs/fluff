import { Property } from '@fluffjs/fluff';

export class NativePropertyHolder
{
    public readonly enabled = new Property<boolean>({
        initialValue: false,
        propertyName: 'enabled'
    });
}
