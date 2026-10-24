# Assign phone numbers to Cody and Jagar

## What I found
- **+1 (580) 217-8444** is already in the app under Cody's team. It's currently shared with 2 people.
- **+1 (817) 508-9595** isn't in the app yet.
- **jagarforbes@gmail.com** has an account but isn't on any team.

## What I'll do
1. **Cody, +1 (580) 217-8444:** make sure it's assigned to codyforbes@gmail.com and marked as approved for texting, so texts go out through the approved texting setup.
2. **Jagar, +1 (817) 508-9595:**
   - Give Jagar their own team, with Jagar as owner.
   - Look the number up in the connected Twilio account and add it to Jagar's team with its existing settings.
   - Assign the number to Jagar.
   - It won't be marked as approved for texting, so the app will say texting needs approval first.
3. **Check it worked:** each user sees only their own number, and Cody's number shows as ready for texting.

## Limits
- I won't change any call or text settings on the numbers in Twilio. The protected +1 (817) 533-8844 stays exactly as it is.
- I won't change any code and won't publish.
- If +1 (817) 508-9595 isn't in the connected Twilio account, I'll stop and tell you.

## Technical notes
- These are data changes made through the database tools (workspaces, workspace_members, phone_numbers, number_assignees). No schema changes.
- Cody's existing assignees on 8444 stay as they are unless you ask me to remove them.
