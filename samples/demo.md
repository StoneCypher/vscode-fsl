# vscode-fsl demo

A traffic light:

```fsl
Red -> Green -> Yellow -> Red;
```

Sized:

```fsl width=300
Off 'toggle' <-> On;
```

Capped growth (natural size, but never taller than 200px — letterboxes instead of stretching):

```fsl max-height=200
A -> B -> C -> D -> E -> A;
```

Not ours (must stay a normal code block):

```js
const x = 1;
```

Stochastic (weighted transitions; jssm 5.157.x ships no stochastic toolbar control yet):

```fsl
Working 80% -> Working;
Working 20% -> Broken;
Broken 'fix' -> Working;
```

Broken on purpose (error-box case):

```fsl
this is not -> valid ->;
```
