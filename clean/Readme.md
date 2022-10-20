# What is this?

Clean scripts.

Will 



## Okay, what do we find in here?

| Script | Description |
|-----|----
| `gru.sh` | Checks the result folders, set up communication channels to which the minions [^1] can connect. Then starts the minions and fill up the Qs with work. |
| `minion` | Connects to Q, evaluates the file / directory. |
| `_vars` | Internal bash script which exports commonly used variables. |

[^1] In the hope that the terminology is [politically correct](https://en.wikipedia.org/wiki/Master/slave_%28technology%29#Replacement_terms). Naming then inspired by [Salt](https://docs.saltproject.io/en/latest/ref/configuration/minion.html) and the [Minions (movie)](https://en.wikipedia.org/wiki/Minions_%28film%29).
