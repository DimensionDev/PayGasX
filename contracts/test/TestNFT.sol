// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TESTNFT is ERC721 {
    constructor() ERC721("TEST NFT", "TESTNFT") {}

    function mint(address to, uint256 _tokenId) public {
        _safeMint(to, _tokenId);
    }
}
