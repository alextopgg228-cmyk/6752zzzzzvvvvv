USE [pr_Maksimenkov_skins];
GO

-- 1. Добавляем колонку ImageURL (если её нет)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Skins') AND name = 'ImageURL')
BEGIN
    ALTER TABLE [dbo].[Skins] ADD [ImageURL] NVARCHAR(500) NULL;
    PRINT '✅ Колонка ImageURL добавлена';
END
GO

-- 2. Очищаем SkinName от дублей оружия
UPDATE [dbo].[Skins] 
SET [SkinName] = REPLACE([SkinName], [WeaponName] + ' | ', '')
WHERE [SkinName] LIKE [WeaponName] + ' | %';
PRINT '✅ Названия скинов очищены';
GO

-- 3. Добавляем фото для всех скинов (временные заглушки)
UPDATE [dbo].[Skins] SET [ImageURL] = 'https://via.placeholder.com/360x200/1e2d45/7a8aa8?text=CS2+Skin';
PRINT '✅ Добавлены заглушки для фото';
GO

-- 4. Проверяем результат
SELECT [SkinID], [SkinName], [WeaponName], [ImageURL] FROM [dbo].[Skins];
GO
