# Data Structure in UserOperation.calldata

| Offset | Field                             | Block Size | Note             |
| ------ | --------------------------------- | ---------- | ---------------- |
| 0      | `execFromEntryPoint()` fs\*       | 4          |                  |
| 4      | destination address               | 32         | 1st param        |
| 36     | `msg.value` to send               | 32         | 2nd param        |
| 68     | location of data of `func`        | 32         | 3rd param        |
| 100    | number of element of bytes `func` | 32         | 3rd param        |
| 132    | fs\* of target contract to call   | 4          | target call func |
| 136    | target func parameter             | N/A        |                  |

\* fs: function selector

`execFromEntryPoint()` requires three parameters:

- `address dest`: the target contract/ account address.
- `uint256 value`: value to be included in this call.
- `bytes func`: the data to be handled by target contract. Check [how dynamic type is used in parameter](https://docs.soliditylang.org/en/v0.8.11/abi-spec.html#use-of-dynamic-types).

**Note**: The parameters are padded to 32 bytes.
