# Engine Design

## Display order (CEO locked)

```
2AZ-FE
2.4L Petrol
Compatible Vehicles:
Toyota Camry · RAV4 · Harrier · Alphard
```

Card compact form:

```
2AZ-FE · 2.4L Petrol
Fits Camry · RAV4 · Alphard
```

or

```
2AZ-FE · 2.4L Petrol
Camry · RAV4 · +4 Models
```

## Rules

1. Engine Code is primary identity.
2. Never imply a single “the” vehicle.
3. Applications from real `applications` string / knowledge models only.
4. Truncate: show 2–3 models + `+N Models`.
5. No applications data → **hide** summary line（不写 “Fits many vehicles”）。
6. Card height stays within current catalog rhythm.

## Detail H1

`Toyota 2AZ-FE 2.4L Petrol Engine`  
Degrade missing pieces: `Toyota 2AZ-FE Engine` / `2AZ-FE 2.4L Engine`.

## Compatible Vehicles module

- Heading: Compatible Vehicles  
- Bullets: Brand + Model when brand known; else model token as stored  
- Disclaimer (short): see `compatible-vehicles-policy.md`  
- Link to existing brand/half-cut pages only when URL exists

## Forbidden copy

Guaranteed fit / Direct replacement / Fits all / Fully compatible
