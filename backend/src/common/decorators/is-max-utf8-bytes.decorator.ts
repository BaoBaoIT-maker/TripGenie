import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsMaxUtf8Bytes(maxBytes: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isMaxUtf8Bytes',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [maxBytes],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return Buffer.byteLength(value, 'utf8') <= args.constraints[0];
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} không được vượt quá ${args.constraints[0]} bytes (chuẩn UTF-8)`;
        },
      },
    });
  };
}
