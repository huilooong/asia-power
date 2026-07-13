# Compatible Vehicles Policy

## Meaning

> This engine code has **application records** on these vehicles.

Does **not** mean: any year, market, or accessory set is interchangeable.

## Allowed wording

- Applications include  
- Commonly used in  
- Compatible vehicles may include  
- Confirm by engine photo, engine number or VIN before ordering  

## Forbidden wording

- Guaranteed fit  
- Direct replacement  
- Fits all  
- Fully compatible  

（除非未来有独立验证证据——本阶段没有。）

## Data sources allowed this phase

1. `ENGINE_DIRECTORY.applications` tokens  
2. Existing generated engine HTML application tables（只读展示）  
3. `knowledge/engines/*.json` `applications.models` when present  

## Not allowed this phase

- Invent vehicles to fill empty lists  
- Auto-create vehicle landing pages  
- Treat inventory single-model hit as exclusive identity  

## Disclaimer (detail module)

```
Applications may vary by year, market and specification.
Confirm by engine photo, engine number or VIN before ordering.
```
