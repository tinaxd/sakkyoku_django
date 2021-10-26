# Generated by Django 3.2 on 2021-10-12 14:19

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Song',
            fields=[
                ('song_id', models.IntegerField(primary_key=True, serialize=False, verbose_name='曲ID')),
                ('user_id', models.IntegerField(verbose_name='ユーザーID')),
                ('name', models.CharField(max_length=255, verbose_name='曲名')),
                ('is_on_release', models.BooleanField(verbose_name='公開設定')),
                ('created_date', models.DateTimeField(verbose_name='作成日時')),
                ('released_date', models.DateTimeField(verbose_name='公開日時')),
                ('last_updated_date', models.DateTimeField(verbose_name='更新日時')),
            ],
        ),
    ]
