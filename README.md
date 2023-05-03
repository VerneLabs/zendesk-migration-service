# Migration services

### Environments: 

##### we need to have config vars or a .env file at the root of the project:

    TOKEN: as Zendesk token
    HOSTNAME: Zendesk domian like this one pdi-vrnlbs.zendesk.com
    USERNAME: mail of a user in zendesk with the administrator granting
    TIME_ZONE: America/Bogota  => that should be dafault value
    FIXED_COMMENT_USER: zendesk user id of the user that you want to be submitter of the pdf files, we should add only their zendesk id
    SHOW_LOGS: bool variable that will show logs when enter to each functions (optional)
        
        
### Install dependencies: 
```
npm install
```
### Run Project: 
```
npm start
