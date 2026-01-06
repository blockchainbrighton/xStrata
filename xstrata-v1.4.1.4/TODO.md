Still need to fix the logic around the chunking and sealing.

If filesize is smaller than the chunk size then it should all be inscribed in a single chunk that initialises and seals itself if possible

Can we also, for larger files still make the first chunk initialise and chunk then make the last chunk chunk and seal so we remove unnecessary steps and transactions?

We still need to fully understand the full inscription process and logic to understand why it's only the sealing txn that pops up too quickly and causes a "user cancelled" issue every time but it is not comeing from me - it is something we are doing that makes the wallet want to exit from the transaction until we come back again, it checks for existing chunks and only after this check does it do the correct txn that then goes throiugh . Please work out what is going on and how to fix it.
