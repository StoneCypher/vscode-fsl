# vscode-fsl demo

A traffic light:

```fsl
Red -> Green -> Yellow -> Red;
```

Sized:

```fsl width=300
Off 'toggle' <-> On;
```

Not ours (must stay a normal code block):

```js
const x = 1;
```

Stochastic (enables the Stochastic toolbar action):

```fsl
Working 80% -> Working;
Working 20% -> Broken;
Broken 'fix' -> Working;
```

Broken on purpose (error-box case):

```fsl
this is not -> valid ->;
```
