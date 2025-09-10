// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract BatchIt {
    address public owner;
    
    // Address used to represent ETH in token parameter (address(0) represents ETH)
    address constant ETH_ADDRESS = address(0);
    
    event BatchTransfer(address indexed token, address indexed from, uint256 totalAmount, uint256 recipientCount);
    event TransferFailed(address indexed recipient, uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Unified batch transfer function for both ERC20 tokens and ETH
     * @param token The ERC20 token contract address (use address(0) for ETH)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts corresponding to each recipient
     */
    function batchTransfer(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable {
        require(recipients.length > 0, "No recipients provided");
        require(recipients.length == amounts.length, "Recipients and amounts length mismatch");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            totalAmount += amounts[i];
        }
        
        uint256 successfulTransfers = 0;
        uint256 totalTransferred = 0;
        
        if (token == ETH_ADDRESS) {
            // Handle ETH transfers
            require(msg.value >= totalAmount, "Insufficient ETH sent");
            
            for (uint256 i = 0; i < recipients.length; i++) {
                if (recipients[i] != address(0)) {
                    (bool success, ) = payable(recipients[i]).call{value: amounts[i]}("");
                    if (success) {
                        successfulTransfers++;
                        totalTransferred += amounts[i];
                    } else {
                        emit TransferFailed(recipients[i], amounts[i]);
                    }
                }
            }
            
            // Refund any excess ETH
            uint256 excess = msg.value - totalAmount;
            if (excess > 0) {
                (bool success, ) = payable(msg.sender).call{value: excess}("");
                require(success, "Failed to refund excess ETH");
            }
            
        } else {
            // Handle ERC20 token transfers
            require(msg.value == 0, "ETH not needed for token transfers");
            
            IERC20 tokenContract = IERC20(token);
            
            // Check if sender has enough balance
            require(
                tokenContract.balanceOf(msg.sender) >= totalAmount,
                "Insufficient token balance"
            );
            
            for (uint256 i = 0; i < recipients.length; i++) {
                if (recipients[i] != address(0)) {
                    bool success = tokenContract.transferFrom(msg.sender, recipients[i], amounts[i]);
                    if (success) {
                        successfulTransfers++;
                        totalTransferred += amounts[i];
                    } else {
                        emit TransferFailed(recipients[i], amounts[i]);
                    }
                }
            }
        }
        
        emit BatchTransfer(token, msg.sender, totalTransferred, successfulTransfers);
    }
    
    /**
     * @dev Batch transfer tokens to multiple recipients with equal amounts (unified version)
     * @param token The ERC20 token contract address (use address(0) for ETH)
     * @param recipients Array of recipient addresses
     * @param amount Amount of tokens/ETH to send to each recipient
     */
    function batchTransferEqual(
        address token,
        address[] calldata recipients,
        uint256 amount
    ) external payable {
        require(recipients.length > 0, "No recipients provided");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 totalAmount = amount * recipients.length;
        uint256 successfulTransfers = 0;
        
        if (token == ETH_ADDRESS) {
            // Handle ETH transfers
            require(msg.value >= totalAmount, "Insufficient ETH sent");
            
            for (uint256 i = 0; i < recipients.length; i++) {
                if (recipients[i] != address(0)) {
                    (bool success, ) = payable(recipients[i]).call{value: amount}("");
                    if (success) {
                        successfulTransfers++;
                    } else {
                        emit TransferFailed(recipients[i], amount);
                    }
                }
            }
            
            // Refund any excess ETH
            uint256 excess = msg.value - totalAmount;
            if (excess > 0) {
                (bool success, ) = payable(msg.sender).call{value: excess}("");
                require(success, "Failed to refund excess ETH");
            }
            
        } else {
            // Handle ERC20 token transfers
            require(msg.value == 0, "ETH not needed for token transfers");
            
            IERC20 tokenContract = IERC20(token);
            
            // Check if sender has enough balance
            require(
                tokenContract.balanceOf(msg.sender) >= totalAmount,
                "Insufficient token balance"
            );
            
            for (uint256 i = 0; i < recipients.length; i++) {
                if (recipients[i] != address(0)) {
                    bool success = tokenContract.transferFrom(msg.sender, recipients[i], amount);
                    if (success) {
                        successfulTransfers++;
                    } else {
                        emit TransferFailed(recipients[i], amount);
                    }
                }
            }
        }
        
        emit BatchTransfer(token, msg.sender, amount * successfulTransfers, successfulTransfers);
    }
    
    // Keep original functions for backward compatibility
    
    /**
     * @dev Batch transfer tokens to multiple recipients with equal amounts
     * @param token The ERC20 token contract address
     * @param recipients Array of recipient addresses
     * @param amount Amount of tokens to send to each recipient
     */
    // function batchTransferEqual(
    //     address token,
    //     address[] calldata recipients,
    //     uint256 amount
    // ) external {
    //     require(recipients.length > 0, "No recipients provided");
    //     require(amount > 0, "Amount must be greater than 0");
        
    //     IERC20 tokenContract = IERC20(token);
    //     uint256 totalAmount = amount * recipients.length;
        
    //     // Check if sender has enough balance
    //     require(
    //         tokenContract.balanceOf(msg.sender) >= totalAmount,
    //         "Insufficient token balance"
    //     );
        
    //     uint256 successfulTransfers = 0;
        
    //     for (uint256 i = 0; i < recipients.length; i++) {
    //         if (recipients[i] != address(0)) {
    //             bool success = tokenContract.transferFrom(msg.sender, recipients[i], amount);
    //             if (success) {
    //                 successfulTransfers++;
    //             } else {
    //                 emit TransferFailed(recipients[i], amount);
    //             }
    //         }
    //     }
        
    //     emit BatchTransfer(token, msg.sender, amount * successfulTransfers, successfulTransfers);
    // }
    
    // /**
    //  * @dev Batch transfer tokens to multiple recipients with different amounts
    //  * @param token The ERC20 token contract address
    //  * @param recipients Array of recipient addresses
    //  * @param amounts Array of amounts corresponding to each recipient
    //  */
    // function batchTransferDifferent(
    //     address token,
    //     address[] calldata recipients,
    //     uint256[] calldata amounts
    // ) external {
    //     require(recipients.length > 0, "No recipients provided");
    //     require(recipients.length == amounts.length, "Recipients and amounts length mismatch");
        
    //     IERC20 tokenContract = IERC20(token);
        
    //     // Calculate total amount needed
    //     uint256 totalAmount = 0;
    //     for (uint256 i = 0; i < amounts.length; i++) {
    //         require(amounts[i] > 0, "Amount must be greater than 0");
    //         totalAmount += amounts[i];
    //     }
        
    //     // Check if sender has enough balance
    //     require(
    //         tokenContract.balanceOf(msg.sender) >= totalAmount,
    //         "Insufficient token balance"
    //     );
        
    //     uint256 successfulTransfers = 0;
    //     uint256 totalTransferred = 0;
        
    //     for (uint256 i = 0; i < recipients.length; i++) {
    //         if (recipients[i] != address(0)) {
    //             bool success = tokenContract.transferFrom(msg.sender, recipients[i], amounts[i]);
    //             if (success) {
    //                 successfulTransfers++;
    //                 totalTransferred += amounts[i];
    //             } else {
    //                 emit TransferFailed(recipients[i], amounts[i]);
    //             }
    //         }
    //     }
        
    //     emit BatchTransfer(token, msg.sender, totalTransferred, successfulTransfers);
    // }
    
    // /**
    //  * @dev Batch transfer native ETH to multiple recipients
    //  * @param recipients Array of recipient addresses
    //  * @param amounts Array of amounts (in wei) corresponding to each recipient
    //  */
    // function batchTransferETH(
    //     address[] calldata recipients,
    //     uint256[] calldata amounts
    // ) external payable {
    //     require(recipients.length > 0, "No recipients provided");
    //     require(recipients.length == amounts.length, "Recipients and amounts length mismatch");
        
    //     uint256 totalAmount = 0;
    //     for (uint256 i = 0; i < amounts.length; i++) {
    //         totalAmount += amounts[i];
    //     }
        
    //     require(msg.value >= totalAmount, "Insufficient ETH sent");
        
    //     uint256 successfulTransfers = 0;
        
    //     for (uint256 i = 0; i < recipients.length; i++) {
    //         if (recipients[i] != address(0) && amounts[i] > 0) {
    //             (bool success, ) = payable(recipients[i]).call{value: amounts[i]}("");
    //             if (success) {
    //                 successfulTransfers++;
    //             } else {
    //                 emit TransferFailed(recipients[i], amounts[i]);
    //             }
    //         }
    //     }
        
    //     // Refund any excess ETH
    //     uint256 excess = msg.value - totalAmount;
    //     if (excess > 0) {
    //         (bool success, ) = payable(msg.sender).call{value: excess}("");
    //         require(success, "Failed to refund excess ETH");
    //     }
    // }
    
    /**
     * @dev Emergency function to withdraw any tokens accidentally sent to this contract
     * @param token Token contract address (use address(0) for ETH)
     */
    function emergencyWithdraw(address token) external onlyOwner {
        if (token == address(0)) {
            // Withdraw ETH
            uint256 balance = address(this).balance;
            require(balance > 0, "No ETH to withdraw");
            (bool success, ) = payable(owner).call{value: balance}("");
            require(success, "ETH withdrawal failed");
        } else {
            // Withdraw ERC20 tokens
            IERC20 tokenContract = IERC20(token);
            uint256 balance = tokenContract.balanceOf(address(this));
            require(balance > 0, "No tokens to withdraw");
            require(tokenContract.transfer(owner, balance), "Token withdrawal failed");
        }
    }
    
    /**
     * @dev Transfer ownership of the contract
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
}