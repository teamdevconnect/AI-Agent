import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export type OAuthProviderName = 'google' | 'microsoft' | 'github';

export interface OAuthProfile {
  providerId: string;
  email: string;
  name: string;
}

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  private providerConfig(provider: OAuthProviderName): ProviderConfig {

    const cfg = this.config.get<ProviderConfig>(
      `oauth.${provider}`,
    );

    if (!cfg?.clientId) {
      throw new BadRequestException(
        `${provider} OAuth client id missing`,
      );
    }

    if (!cfg?.clientSecret) {
      throw new BadRequestException(
        `${provider} OAuth secret missing`,
      );
    }

    if (!cfg?.redirectUri) {
      throw new BadRequestException(
        `${provider} OAuth redirect URI missing`,
      );
    }

    return cfg;
  }


  buildAuthorizeUrl(
    provider: OAuthProviderName,
    state: string,
  ): string {

    const {
      clientId,
      redirectUri,
    } = this.providerConfig(provider);


    // GOOGLE
    if (provider === 'google') {

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        response_mode: 'query',
        scope:
          'openid email profile',
        state,
      });


      return (
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        params.toString()
      );
    }


    // MICROSOFT
    if (provider === 'microsoft') {

      const tenant =
        this.config.get<string>(
          'oauth.microsoft.tenant',
        ) || 'common';


      const params = new URLSearchParams({

        client_id: clientId,

        redirect_uri: redirectUri,

        response_type: 'code',

        response_mode: 'query',

        scope:
          'openid profile email User.Read',

        state,

        prompt:'select_account',

      });


      const url =
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;

      return url;
    }



    // GITHUB

    const params = new URLSearchParams({

      client_id: clientId,

      redirect_uri: redirectUri,

      scope:
        'read:user user:email',

      state,

    });


    return (
      'https://github.com/login/oauth/authorize?' +
      params.toString()
    );
  }



  async exchangeCodeForProfile(
    provider: OAuthProviderName,
    code: string,
  ): Promise<OAuthProfile> {


    if(provider === 'google'){
      return this.googleProfile(code);
    }


    if(provider === 'microsoft'){
      return this.microsoftProfile(code);
    }


    return this.githubProfile(code);

  }




  private async microsoftProfile(
    code:string,
  ):Promise<OAuthProfile>{


    const {
      clientId,
      clientSecret,
      redirectUri,
    } = this.providerConfig(
      'microsoft'
    );


    const tenant =
      this.config.get<string>(
        'oauth.microsoft.tenant'
      ) || 'common';



    const body =
      new URLSearchParams({

        client_id:clientId,

        client_secret:clientSecret,

        code,

        redirect_uri:redirectUri,

        grant_type:
          'authorization_code',

        scope:
          'openid profile email User.Read',

      });



    const tokenResponse =
      await firstValueFrom(

        this.http.post<{
          access_token:string;
        }>(

          `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,

          body.toString(),

          {
            headers:{
              'Content-Type':
              'application/x-www-form-urlencoded',
            },
          }

        )

      );



    const graphResponse =
      await firstValueFrom(

        this.http.get<{

          id:string;

          mail?:string;

          userPrincipalName:string;

          displayName:string;

        }>(

          'https://graph.microsoft.com/v1.0/me',

          {
            headers:{
              Authorization:
              `Bearer ${tokenResponse.data.access_token}`,
            },
          }

        )

      );



    const profile =
      graphResponse.data;



    return {

      providerId:
        profile.id,

      email:
        profile.mail ??
        profile.userPrincipalName,

      name:
        profile.displayName,

    };

  }



  private async googleProfile(
    code:string,
  ):Promise<OAuthProfile>{

    const {
      clientId,
      clientSecret,
      redirectUri,
    } = this.providerConfig('google');


    const body =
      new URLSearchParams({

        client_id:clientId,

        client_secret:clientSecret,

        code,

        redirect_uri:redirectUri,

        grant_type:
        'authorization_code',

      });



    const token =
      await firstValueFrom(

        this.http.post<{
          access_token:string
        }>(

        'https://oauth2.googleapis.com/token',

        body.toString(),

        {
          headers:{
          'Content-Type':
          'application/x-www-form-urlencoded'
          }
        }

        )

      );


    const profile =
      await firstValueFrom(

        this.http.get<{
          sub:string;
          email:string;
          name:string;

        }>(

        'https://www.googleapis.com/oauth2/v3/userinfo',

        {
          headers:{
            Authorization:
            `Bearer ${token.data.access_token}`,
          },
        }

        )

      );


    return {

      providerId:
      profile.data.sub,

      email:
      profile.data.email,

      name:
      profile.data.name,

    };

  }



  private async githubProfile(
    code:string,
  ):Promise<OAuthProfile>{

    const {
      clientId,
      clientSecret,
      redirectUri,
    } =
    this.providerConfig('github');



    const token =
      await firstValueFrom(

        this.http.post<{
          access_token:string
        }>(

        'https://github.com/login/oauth/access_token',

        {
          client_id:clientId,
          client_secret:clientSecret,
          code,
          redirect_uri:redirectUri,
        },

        {
          headers:{
            Accept:'application/json'
          }
        }

        )

      );



    if(!token.data.access_token){

      throw new BadRequestException(
        'Github token missing'
      );

    }



    const profile =
      await firstValueFrom(

        this.http.get<{
          id:number;
          login:string;
          name?:string;
          email?:string;

        }>(

        'https://api.github.com/user',

        {
          headers:{
            Authorization:
            `Bearer ${token.data.access_token}`,

            'User-Agent':
            'AI-Agent'
          },
        }

        )

      );


    return {

      providerId:
      String(profile.data.id),

      email:
      profile.data.email ?? '',

      name:
      profile.data.name ??
      profile.data.login,

    };

  }

}